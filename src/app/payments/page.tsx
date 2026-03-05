'use client'

import { ArrowLeft, CheckCircle, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import { fetchGroupMembersMap } from '@/lib/group-members'
import UserAvatar from '@/components/user-avatar'
import { computePendingEdges } from '@/lib/pending-balances'

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

  const toCents = (value: number) => Math.round((Number(value) || 0) * 100)
  const fromCents = (cents: number) => Number((cents / 100).toFixed(2))

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

    const membersIdByGroup = new Map<string, string[]>()
    for (const group of groups) {
      membersIdByGroup.set(
        group.id,
        (membersByGroup.get(group.id) || []).map((m) => m.id).filter(Boolean)
      )
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
      })),
      membersIdByGroup
    )

    const pendingByPair = new Map<string, { groupId: string; fromUserId: string; toUserId: string; amountCents: number; date: string; description: string }>()
    for (const edge of pendingEdges) {
      if (edge.fromUserId !== currentUserId && edge.toUserId !== currentUserId) continue
      const key = `${edge.groupId}|${edge.fromUserId}|${edge.toUserId}`
      const prev = pendingByPair.get(key)
      pendingByPair.set(key, {
        groupId: edge.groupId,
        fromUserId: edge.fromUserId,
        toUserId: edge.toUserId,
        amountCents: (prev?.amountCents || 0) + toCents(edge.amount),
        date: edge.date,
        description: edge.description,
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

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => (filter === 'all' ? true : payment.status === filter))
  }, [payments, filter])

  const pendingPayments = useMemo(() => filteredPayments.filter((p) => p.status === 'pending'), [filteredPayments])

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

      <BottomNav />
    </div>
  )
}

