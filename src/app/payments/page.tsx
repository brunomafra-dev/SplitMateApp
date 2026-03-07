'use client'

import { ArrowLeft, CheckCircle, Clock, Copy, MessageCircle, TrendingDown, TrendingUp, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import { fetchGroupMembersMap } from '@/lib/group-members'
import UserAvatar from '@/components/user-avatar'
import { computePendingEdges } from '@/lib/pending-balances'
import { fromCents, toCents } from '@/lib/money'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface GroupRow {
  id: string
  name: string
}

interface TransactionRow {
  id: string
  group_id: string
  value: number
  payer_id: string
  description?: string
  participants?: string[]
  splits?: Record<string, number>
  status?: string
  created_at?: string
}

interface PaymentRow {
  id: string
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at: string
}

interface DebtDetailItem {
  txId: string
  description: string
  groupName: string
  amount: number
  date: string
}

interface Payment {
  id: string
  description: string
  amount: number
  from: string
  to: string
  fromUserId: string
  toUserId: string
  groupId: string
  status: 'paid' | 'pending'
  date: string
  groupName: string
  fromAvatarKey?: string
  toAvatarKey?: string
  fromIsPremium?: boolean
  toIsPremium?: boolean
  breakdown?: DebtDetailItem[]
}

interface PersonPendingSummary {
  personUserId: string
  name: string
  avatarKey?: string
  isPremium?: boolean
  totalAmount: number
}

export default function Payments() {
  const router = useRouter()

  const [payments, setPayments] = useState<Payment[]>([])
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [loading, setLoading] = useState(true)
  const hasLoadedOnceRef = useRef(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [showMyBalance, setShowMyBalance] = useState(true)
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null)
  const [myPixKey, setMyPixKey] = useState('')
  const [chargeTarget, setChargeTarget] = useState<Payment | null>(null)
  const [chargePixKey, setChargePixKey] = useState('')
  const [detailTarget, setDetailTarget] = useState<Payment | null>(null)

  const load = useCallback(async (showBlockingLoading: boolean = false) => {
    if (showBlockingLoading || !hasLoadedOnceRef.current) {
      setLoading(true)
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const currentUserId = session.user.id
      setMyId(currentUserId)
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('privacy_show_balance')
        .eq('id', currentUserId)
        .maybeSingle()
      setShowMyBalance(Boolean(myProfile?.privacy_show_balance ?? true))
      const { data: myPaymentSettings } = await supabase
        .from('user_payment_settings')
        .select('pix_key')
        .eq('user_id', currentUserId)
        .maybeSingle()
      setMyPixKey(String((myPaymentSettings as { pix_key?: string } | null)?.pix_key || ''))

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id,name')

      if (groupsError) {
        console.error('payments.groups-load-error', groupsError)
        setPayments([])
        return
      }

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })

      if (txError) console.error('payments.transactions-load-error', txError)

      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select('id,group_id,from_user,to_user,amount,created_at')
        .order('created_at', { ascending: false })

      if (payError) console.error('payments.payments-load-error', payError)

      const groups = (groupsData || []) as GroupRow[]
      const allowedGroupIds = new Set(groups.map((g) => g.id))
      const membersByGroup = await fetchGroupMembersMap(groups.map((group) => group.id), currentUserId)
      const txRows = ((txData as TransactionRow[] | null) || [])
        .filter((tx) => allowedGroupIds.has(String(tx.group_id || '')))
        .map((tx) => ({ ...tx, value: Number(tx.value) || 0 }))
      const payRows = ((payData as PaymentRow[] | null) || [])
        .filter((p) => allowedGroupIds.has(String(p.group_id || '')))
        .map((p) => ({ ...p, amount: Number(p.amount) || 0 }))

    const groupMap = new Map<string, GroupRow>()
    groups.forEach((g) => groupMap.set(g.id, g))

    const nameFromGroup = (groupId: string, userId: string) => {
      const list = membersByGroup.get(groupId) || []
      const found = list.find((p) => String(p.id) === String(userId))
      return found?.name || 'Alguem'
    }

    const avatarKeyFromGroup = (groupId: string, userId: string) => {
      const list = membersByGroup.get(groupId) || []
      const found = list.find((p) => String(p.id) === String(userId))
      return found?.avatarKey || ''
    }

    const isPremiumFromGroup = (groupId: string, userId: string) => {
      const list = membersByGroup.get(groupId) || []
      const found = list.find((p) => String(p.id) === String(userId))
      return Boolean(found?.isPremium)
    }

    const pendingEdges = computePendingEdges(
      txRows.map((tx) => ({
        id: tx.id,
        group_id: tx.group_id,
        payer_id: tx.payer_id,
        value: tx.value,
        description: tx.description,
        status: tx.status,
        created_at: tx.created_at,
        participants: Array.isArray(tx.participants) ? tx.participants : undefined,
        splits: tx.splits,
      })),
      payRows.map((p) => ({
        group_id: p.group_id,
        from_user: p.from_user,
        to_user: p.to_user,
        amount: p.amount,
        created_at: p.created_at,
      }))
    )

    const pendingByPair = new Map<string, {
      groupId: string
      fromUserId: string
      toUserId: string
      amountCents: number
      date: string
      description: string
      breakdown: DebtDetailItem[]
    }>()
    for (const edge of pendingEdges) {
      if (edge.fromUserId !== currentUserId && edge.toUserId !== currentUserId) continue
      const key = `${edge.groupId}|${edge.fromUserId}|${edge.toUserId}`
      const prev = pendingByPair.get(key)
      const groupName = groupMap.get(edge.groupId)?.name || 'Grupo'
      const detailItem: DebtDetailItem = {
        txId: edge.txId,
        description: edge.description || 'Acerto de gasto',
        groupName,
        amount: fromCents(toCents(edge.amount)),
        date: edge.date,
      }
      pendingByPair.set(key, {
        groupId: edge.groupId,
        fromUserId: edge.fromUserId,
        toUserId: edge.toUserId,
        amountCents: (prev?.amountCents || 0) + toCents(edge.amount),
        date: edge.date,
        description: edge.description,
        breakdown: [...(prev?.breakdown || []), detailItem],
      })
    }

    const pendingFromTransactions: Payment[] = Array.from(pendingByPair.entries()).map(([key, item]) => {
      const groupName = groupMap.get(item.groupId)?.name || 'Grupo'
      return {
        id: `pending_${key}`,
        description: item.description,
        amount: fromCents(item.amountCents),
        from: item.fromUserId === currentUserId ? 'Voce' : nameFromGroup(item.groupId, item.fromUserId),
        to: item.toUserId === currentUserId ? 'Voce' : nameFromGroup(item.groupId, item.toUserId),
        fromUserId: item.fromUserId,
        toUserId: item.toUserId,
        groupId: item.groupId,
        status: 'pending',
        date: item.date,
        groupName,
        fromAvatarKey: avatarKeyFromGroup(item.groupId, item.fromUserId),
        toAvatarKey: avatarKeyFromGroup(item.groupId, item.toUserId),
        fromIsPremium: isPremiumFromGroup(item.groupId, item.fromUserId),
        toIsPremium: isPremiumFromGroup(item.groupId, item.toUserId),
        breakdown: [...item.breakdown].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }
    })

    const paidFromPayments: Payment[] = payRows
      .filter((p) => p.from_user === currentUserId || p.to_user === currentUserId)
      .map((p) => ({
        id: `paid_${p.id}`,
        description: 'Pagamento registrado',
        amount: p.amount,
        from: p.from_user === currentUserId ? 'Voce' : nameFromGroup(p.group_id, p.from_user),
        to: p.to_user === currentUserId ? 'Voce' : nameFromGroup(p.group_id, p.to_user),
        fromUserId: p.from_user,
        toUserId: p.to_user,
        groupId: p.group_id,
        status: 'paid',
        date: p.created_at,
        groupName: groupMap.get(p.group_id)?.name || 'Grupo',
        fromAvatarKey: avatarKeyFromGroup(p.group_id, p.from_user),
        toAvatarKey: avatarKeyFromGroup(p.group_id, p.to_user),
        fromIsPremium: isPremiumFromGroup(p.group_id, p.from_user),
        toIsPremium: isPremiumFromGroup(p.group_id, p.to_user),
      }))

      const merged = [...paidFromPayments, ...pendingFromTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setPayments(merged)
    } catch (error) {
      console.error('payments.load-unhandled-error', error)
      setPayments([])
    } finally {
      hasLoadedOnceRef.current = true
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load(true)

    const channel = supabase
      .channel('payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        load(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        load(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        load(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        load(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const handleRegisterPayment = useCallback(async (pending: Payment) => {
    if (!myId || pending.status !== 'pending') return
    if (pending.toUserId !== myId) {
      setFeedback({ type: 'error', text: 'Apenas o credor pode marcar como pago.' })
      return
    }

    const allowed = checkRateLimit(myId, 'registerPayment', RATE_LIMITS.registerPayment)
    if (!allowed) {
      setFeedback({ type: 'error', text: 'Muitas ações em pouco tempo. Tente novamente.' })
      return
    }

    setProcessingPaymentId(pending.id)
    setFeedback(null)

    const amount = fromCents(toCents(Number(pending.amount) || 0))
    const payload = {
      group_id: pending.groupId,
      from_user: pending.fromUserId,
      to_user: pending.toUserId,
      amount,
    }

    const { error } = await supabase.from('payments').insert(payload)

    if (error) {
      console.error('payments.register-payment-error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload,
      })
      setFeedback({ type: 'error', text: 'Erro ao registrar pagamento.' })
      setProcessingPaymentId(null)
      return
    }

    setFeedback({
      type: 'success',
      text: pending.toUserId === myId ? 'Cobranca registrada.' : 'Pagamento registrado.',
    })
    await load(false)
    router.refresh()
    setProcessingPaymentId(null)
  }, [load, myId, router])

  const buildChargeMessage = useCallback((pending: Payment, pixKey: string) => {
    const amountLabel = pending.amount.toFixed(2)
    const pix = pixKey.trim()
    return [
      'Ola! 😊',
      '',
      `Voce ficou com R$ ${amountLabel} referente ao grupo ${pending.groupName}.`,
      'Quando puder, me envia via PIX por favor. Obrigado!',
      '',
      pix ? `PIX copia e cola: ${pix}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }, [])

  const chargeMessage = useMemo(() => {
    if (!chargeTarget) return ''
    return buildChargeMessage(chargeTarget, chargePixKey)
  }, [buildChargeMessage, chargePixKey, chargeTarget])

  const handleOpenCharge = useCallback((pending: Payment) => {
    setChargeTarget(pending)
    setChargePixKey(myPixKey)
  }, [myPixKey])

  const handleOpenDetails = useCallback((pending: Payment) => {
    setDetailTarget(pending)
  }, [])

  const handleCopyChargeMessage = useCallback(async () => {
    if (!chargeMessage) return
    await navigator.clipboard.writeText(chargeMessage)
    setFeedback({ type: 'success', text: 'Mensagem de cobranca copiada.' })
  }, [chargeMessage])

  const handleWhatsAppCharge = useCallback(() => {
    if (!chargeMessage) return
    const url = `https://wa.me/?text=${encodeURIComponent(chargeMessage)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [chargeMessage])

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => (filter === 'all' ? true : payment.status === filter))
  }, [payments, filter])

  const pendingPayments = useMemo(() => filteredPayments.filter((p) => p.status === 'pending'), [filteredPayments])

  const pendingList = useMemo(() => {
    return [...pendingPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [pendingPayments])

  const payableByPerson = useMemo(() => {
    if (!myId) return [] as PersonPendingSummary[]
    const grouped = new Map<string, PersonPendingSummary>()
    for (const item of pendingPayments) {
      if (item.fromUserId !== myId) continue
      const current = grouped.get(item.toUserId)
      if (current) {
        current.totalAmount = fromCents(toCents(current.totalAmount) + toCents(item.amount))
      } else {
        grouped.set(item.toUserId, {
          personUserId: item.toUserId,
          name: item.to,
          avatarKey: item.toAvatarKey,
          isPremium: item.toIsPremium,
          totalAmount: item.amount,
        })
      }
    }
    return Array.from(grouped.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [pendingPayments, myId])

  const paidList = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'paid')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filteredPayments])

  const totalToReceive = fromCents(
    payments
      .filter((p) => p.status === 'pending' && p.toUserId === myId)
      .reduce((acc, p) => acc + toCents(p.amount), 0)
  )

  const totalToPay = fromCents(
    payments
      .filter((p) => p.status === 'pending' && p.fromUserId === myId)
      .reduce((acc, p) => acc + toCents(p.amount), 0)
  )

  const peopleBalance = useMemo(() => {
    const map = new Map<string, { name: string; avatarKey?: string; isPremium?: boolean; amountCents: number }>()

    for (const p of payments) {
      if (p.status !== 'pending' || !myId) continue

      if (p.toUserId === myId) {
        const key = p.fromUserId
        const prev = map.get(key)
        map.set(key, {
          name: p.from,
          avatarKey: p.fromAvatarKey,
          isPremium: p.fromIsPremium,
          amountCents: (prev?.amountCents || 0) + toCents(p.amount),
        })
      } else if (p.fromUserId === myId) {
        const key = p.toUserId
        const prev = map.get(key)
        map.set(key, {
          name: p.to,
          avatarKey: p.toAvatarKey,
          isPremium: p.toIsPremium,
          amountCents: (prev?.amountCents || 0) - toCents(p.amount),
        })
      }
    }

    return Array.from(map.entries())
      .map(([userId, value]) => ({ userId, ...value, amount: fromCents(value.amountCents) }))
      .filter((item) => toCents(item.amount) !== 0)
      .sort((a, b) => Math.abs(toCents(b.amount)) - Math.abs(toCents(a.amount)))
  }, [payments, myId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden page-fade">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="tap-target pressable text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">Pagamentos</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {feedback && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {feedback.text}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-emerald-950/45 rounded-xl p-4 text-center border border-green-100 dark:border-emerald-800/70">
              <TrendingUp className="w-5 h-5 text-[#5BC5A7] mx-auto mb-2" />
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">A Receber</p>
              <p className="text-lg font-bold text-[#5BC5A7]">{showMyBalance ? `R$ ${totalToReceive.toFixed(2)}` : 'Oculto'}</p>
            </div>
            <div className="bg-red-50 dark:bg-rose-950/45 rounded-xl p-4 text-center border border-red-100 dark:border-rose-800/70">
              <TrendingDown className="w-5 h-5 text-[#FF6B6B] mx-auto mb-2" />
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">A Pagar</p>
              <p className="text-lg font-bold text-[#FF6B6B]">{showMyBalance ? `R$ ${totalToPay.toFixed(2)}` : 'Oculto'}</p>
            </div>
          </div>

          <div className="mt-4 surface-card p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Balanço por pessoa</h2>
            {peopleBalance.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum saldo pendente por pessoa.</p>
            ) : (
              <div className="space-y-2">
                {peopleBalance.map((person) => (
                  <div key={person.userId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={person.name} avatarKey={person.avatarKey} isPremium={person.isPremium} className="w-8 h-8" textClassName="text-xs" />
                      <p className="text-sm font-medium text-gray-800 truncate">{person.name}</p>
                    </div>
                    <p className={`text-sm font-semibold ${person.amount >= 0 ? 'text-[#5BC5A7]' : 'text-[#FF6B6B]'}`}>
                      {showMyBalance ? `R$ ${Math.abs(person.amount).toFixed(2)} ${person.amount >= 0 ? 'te deve' : 'você deve'}` : 'Oculto'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`tap-target pressable px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">Todos</button>
            <button onClick={() => setFilter('paid')} className={`tap-target pressable px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'paid' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">Pagos</button>
            <button onClick={() => setFilter('pending')} className={`tap-target pressable px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">Pendentes</button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum pagamento</h3>
            <p className="text-gray-600">{filter === 'all' ? 'Voce ainda nao tem pagamentos registrados' : filter === 'paid' ? 'Nenhum pagamento concluido' : 'Nenhum pagamento pendente'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(filter === 'all' || filter === 'pending') && (
              <>
                <div className="surface-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-800">A pagar</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-[#FF6B6B]">{payableByPerson.length} pessoa(s)</span>
                  </div>
                  {payableByPerson.length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhuma dívida sua pendente no momento.</p>
                  ) : (
                    <div className="space-y-2">
                      {payableByPerson.map((person) => (
                        <div key={person.personUserId} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar name={person.name} avatarKey={person.avatarKey} isPremium={person.isPremium} className="w-8 h-8" textClassName="text-xs" />
                              <p className="text-sm font-medium text-gray-800 truncate">{person.name}</p>
                            </div>
                            <p className="text-sm font-semibold text-[#FF6B6B]">{showMyBalance ? `R$ ${person.totalAmount.toFixed(2)}` : 'Oculto'}</p>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">Valor pendente com este participante.</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="surface-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-800">Pendencias abertas</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{pendingList.length} item(ns)</span>
                  </div>

                  {pendingList.length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhuma pendencia aberta.</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingList.map((pending) => {
                        const isCreditor = pending.toUserId === myId
                        const isDebtor = pending.fromUserId === myId
                        const counterpartName = isCreditor ? pending.from : pending.to
                        const counterpartAvatar = isCreditor ? pending.fromAvatarKey : pending.toAvatarKey
                        const counterpartPremium = isCreditor ? pending.fromIsPremium : pending.toIsPremium
                        const isProcessing = processingPaymentId === pending.id

                        return (
                          <div
                            key={pending.id}
                            className="p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer"
                            onClick={() => handleOpenDetails(pending)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <UserAvatar
                                  name={counterpartName}
                                  avatarKey={counterpartAvatar}
                                  isPremium={counterpartPremium}
                                  className="w-8 h-8"
                                  textClassName="text-xs"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{counterpartName}</p>
                                  <p className="text-xs text-gray-500 truncate">{pending.groupName}</p>
                                </div>
                              </div>

                              <p className="text-sm font-semibold text-gray-800">
                                {showMyBalance ? `R$ ${pending.amount.toFixed(2)}` : 'Oculto'}
                              </p>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="text-xs text-gray-500">
                                {isCreditor ? 'Essa pessoa te deve este valor.' : 'Voce deve este valor para essa pessoa.'}
                              </p>
                              <div className="flex items-center gap-2">
                                {isCreditor && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenCharge(pending)
                                      }}
                                      disabled={isProcessing}
                                      className="tap-target pressable px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-60"
                                    >
                                      Cobrar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRegisterPayment(pending)
                                      }}
                                      disabled={isProcessing}
                                      className="tap-target pressable px-3 py-2 rounded-lg bg-[#5BC5A7] hover:bg-[#4AB396] text-white text-xs font-medium disabled:opacity-60"
                                    >
                                      {isProcessing ? 'Salvando...' : 'Marcar como pago'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {isDebtor && (
                              <p className="mt-2 text-xs text-gray-500">
                                Somente quem tem a receber pode confirmar este pagamento.
                              </p>
                            )}
                            <p className="mt-2 text-xs text-gray-500 underline">Toque para ver detalhes da origem</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {paidList.map((payment) => (
              <div key={payment.id} className="surface-card p-4 surface-card-hover">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <UserAvatar name={payment.from} avatarKey={payment.fromAvatarKey} isPremium={payment.fromIsPremium} className="w-7 h-7" textClassName="text-[10px]" />
                      <h3 className="text-base font-medium text-gray-800">{payment.description}</h3>
                      <CheckCircle className="w-4 h-4 text-[#5BC5A7]" />
                    </div>
                    <p className="text-sm text-gray-600">{payment.from} {'->'} {payment.to}</p>
                    <p className="text-xs text-gray-500 mt-1">{payment.groupName}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-semibold text-gray-800">{showMyBalance ? `R$ ${payment.amount.toFixed(2)}` : 'Oculto'}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-[#5BC5A7]">Pago</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span>{new Date(payment.date).toLocaleDateString('pt-BR')}</span>
                  <span>{new Date(payment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="max-w-4xl w-full mx-auto px-4 py-4">
        <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
          <p className="text-xs text-gray-500">Espaco reservado para anuncio</p>
        </div>
      </div>

      {detailTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4 max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Origem da dívida</h3>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="tap-target pressable text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-sm font-medium text-gray-800">
                {detailTarget.toUserId === myId
                  ? `${detailTarget.from} te deve`
                  : `Voce deve para ${detailTarget.to}`}
                {showMyBalance ? ` R$ ${detailTarget.amount.toFixed(2)}` : ''}
              </p>
              <p className="text-xs text-gray-500 mt-1">{detailTarget.groupName}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Detalhes</p>
              {(detailTarget.breakdown || []).length === 0 ? (
                <p className="text-sm text-gray-600">Sem detalhes para esta dívida.</p>
              ) : (
                <div className="space-y-2">
                  {(detailTarget.breakdown || []).map((item) => (
                    <div key={`${detailTarget.id}-${item.txId}`} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.description}</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {showMyBalance ? `R$ ${item.amount.toFixed(2)}` : 'Oculto'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                        <span>{item.groupName}</span>
                        <span>{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Total</p>
              <p className="text-sm font-bold text-gray-900">
                {showMyBalance ? `R$ ${detailTarget.amount.toFixed(2)}` : 'Oculto'}
              </p>
            </div>
          </div>
        </div>
      )}

      {chargeTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4 max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Cobrar pagamento</h3>
              <button
                type="button"
                onClick={() => setChargeTarget(null)}
                className="tap-target pressable text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-sm text-gray-600">Grupo</p>
              <p className="text-sm font-medium text-gray-800">{chargeTarget.groupName}</p>
              <p className="text-sm text-gray-600 mt-2">Valor</p>
              <p className="text-lg font-semibold text-gray-800">
                {showMyBalance ? `R$ ${chargeTarget.amount.toFixed(2)}` : 'Oculto'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">PIX copia e cola (opcional)</label>
              <input
                type="text"
                value={chargePixKey}
                onChange={(e) => setChargePixKey(e.target.value)}
                placeholder="Cole sua chave ou codigo PIX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Mensagem</label>
              <textarea
                readOnly
                value={chargeMessage}
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyChargeMessage}
                className="tap-target pressable flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copiar mensagem
              </button>
              <button
                type="button"
                onClick={handleWhatsAppCharge}
                className="tap-target pressable flex-1 px-3 py-2 bg-[#25D366] rounded-lg text-white hover:brightness-95 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

