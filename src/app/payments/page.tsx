'use client'

import { ArrowLeft, CheckCircle, Clock, TrendingDown, TrendingUp, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import { fetchGroupMembersMap } from '@/lib/group-members'

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
}

function buildChargeMessage(groupName: string, amount: number, pixCode?: string): string {
  const amountText = amount.toFixed(2).replace('.', ',')
  const pixBlock = pixCode?.trim() ? `\n\nPIX copia e cola:\n${pixCode.trim()}` : ''
  return `Olá! 😊\nVocê ficou com R$ ${amountText} referente ao grupo ${groupName}.\nQuando puder, me envia via PIX por favor. Obrigado!${pixBlock}`
}

export default function Payments() {
  const router = useRouter()

  const [payments, setPayments] = useState<Payment[]>([])
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [selfPaidTotal, setSelfPaidTotal] = useState(0)
  const [chargeTarget, setChargeTarget] = useState<Payment | null>(null)
  const [pixCopyPaste, setPixCopyPaste] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const currentUserId = session.user.id
    setMyId(currentUserId)

    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('id,name')

    if (groupsError) {
      console.error('payments.groups-load-error', groupsError)
      setPayments([])
      setLoading(false)
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
    const membersByGroup = await fetchGroupMembersMap(groups.map((group) => group.id))
    const txRows = ((txData as TransactionRow[] | null) || []).map((tx) => ({ ...tx, value: Number(tx.value) || 0 }))
    const payRows = ((payData as PaymentRow[] | null) || []).map((p) => ({ ...p, amount: Number(p.amount) || 0 }))

    const groupMap = new Map<string, GroupRow>()
    groups.forEach((g) => groupMap.set(g.id, g))

    const nameFromGroup = (groupId: string, userId: string) => {
      const list = membersByGroup.get(groupId) || []
      const found = list.find((p) => String(p.id) === String(userId))
      return found?.name || 'Alguem'
    }

    const pendingByKey = new Map<string, { groupId: string; from: string; to: string; amount: number; date: string; description: string; groupName: string }>()
    let computedSelfPaid = 0

    for (const tx of txRows) {
      if (String(tx.status || '').toLowerCase() === 'paid') continue

      const groupName = groupMap.get(tx.group_id)?.name || 'Grupo'
      const participants = (membersByGroup.get(tx.group_id) || []).map((member) => member.id)

      if (!participants.includes(currentUserId)) continue

      const myShare = participants.length > 0 ? tx.value / participants.length : 0
      if (myShare > 0) computedSelfPaid += myShare

      if (tx.payer_id === currentUserId) {
        for (const debtorId of participants.filter((pid) => pid !== currentUserId)) {
          const amount = participants.length > 0 ? tx.value / participants.length : 0
          if (amount <= 0) continue
          const key = `${tx.group_id}|${debtorId}|${currentUserId}`
          const prev = pendingByKey.get(key)
          pendingByKey.set(key, {
            groupId: tx.group_id,
            from: debtorId,
            to: currentUserId,
            amount: (prev?.amount || 0) + amount,
            date: tx.created_at || new Date().toISOString(),
            description: tx.description || 'Acerto de gasto',
            groupName,
          })
        }
      } else {
        const amount = participants.length > 0 ? tx.value / participants.length : 0
        if (amount <= 0) continue
        const key = `${tx.group_id}|${currentUserId}|${tx.payer_id}`
        const prev = pendingByKey.get(key)
        pendingByKey.set(key, {
          groupId: tx.group_id,
          from: currentUserId,
          to: tx.payer_id,
          amount: (prev?.amount || 0) + amount,
          date: tx.created_at || new Date().toISOString(),
          description: tx.description || 'Acerto de gasto',
          groupName,
        })
      }
    }

    const paidByKey = new Map<string, number>()
    for (const p of payRows) {
      const key = `${p.group_id}|${p.from_user}|${p.to_user}`
      paidByKey.set(key, (paidByKey.get(key) || 0) + p.amount)
    }

    const pendingFromTransactions: Payment[] = []
    for (const [key, item] of pendingByKey.entries()) {
      const paid = paidByKey.get(key) || 0
      const outstanding = Math.max(0, item.amount - paid)
      if (outstanding <= 0.009) continue

      pendingFromTransactions.push({
        id: `pending_${key}`,
        description: item.description,
        amount: Number(outstanding.toFixed(2)),
        from: item.from === currentUserId ? 'Voce' : nameFromGroup(item.groupId, item.from),
        to: item.to === currentUserId ? 'Voce' : nameFromGroup(item.groupId, item.to),
        fromUserId: item.from,
        toUserId: item.to,
        groupId: item.groupId,
        status: 'pending',
        date: item.date,
        groupName: item.groupName,
      })
    }

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
      }))

    const merged = [...paidFromPayments, ...pendingFromTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    setPayments(merged)
    setSelfPaidTotal(Number(computedSelfPaid.toFixed(2)))
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const handleMarkAsReceived = async (payment: Payment) => {
    if (!myId || payment.status !== 'pending' || myId !== payment.toUserId) return

    setSavingId(payment.id)
    try {
      const { error } = await supabase.from('payments').insert({
        group_id: payment.groupId,
        from_user: payment.fromUserId,
        to_user: payment.toUserId,
        amount: payment.amount,
      })

      if (error) {
        console.error('payments.mark-received-error', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          payment,
        })
        alert('Erro ao marcar como recebido')
        return
      }

      await load()
    } finally {
      setSavingId(null)
    }
  }

  const copyChargeMessage = async (payment: Payment) => {
    await navigator.clipboard.writeText(buildChargeMessage(payment.groupName, payment.amount, pixCopyPaste))
    alert('Mensagem copiada')
  }

  const shareChargeMessage = async (payment: Payment) => {
    const message = buildChargeMessage(payment.groupName, payment.amount, pixCopyPaste)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Cobranca - ${payment.groupName}`, text: message })
        return
      } catch {
        // fallback
      }
    }
    await navigator.clipboard.writeText(message)
    alert('Mensagem copiada para compartilhamento')
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => (filter === 'all' ? true : payment.status === filter))
  }, [payments, filter])

  const pendingGrouped = useMemo(() => {
    const grouped = new Map<string, { groupName: string; items: Payment[] }>()
    for (const item of filteredPayments.filter((p) => p.status === 'pending')) {
      const current = grouped.get(item.groupId)
      if (current) current.items.push(item)
      else grouped.set(item.groupId, { groupName: item.groupName, items: [item] })
    }
    return Array.from(grouped.entries()).map(([groupId, value]) => ({
      groupId,
      groupName: value.groupName,
      items: value.items.sort((a, b) => b.amount - a.amount),
    }))
  }, [filteredPayments])

  const paidList = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'paid')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filteredPayments])

  const totalPaid = payments
    .filter((p) => p.status === 'paid' && p.from === 'Voce')
    .reduce((acc, p) => acc + p.amount, 0) + selfPaidTotal

  const totalReceived = payments
    .filter((p) => p.status === 'paid' && p.to === 'Voce' && p.from !== 'Voce')
    .reduce((acc, p) => acc + p.amount, 0)

  const totalPending = payments
    .filter((p) => p.status === 'pending')
    .reduce((acc, p) => acc + p.amount, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Pagamentos</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <TrendingUp className="w-5 h-5 text-[#5BC5A7] mx-auto mb-2" />
              <p className="text-xs text-gray-600 mb-1">Recebido</p>
              <p className="text-lg font-bold text-[#5BC5A7]">R$ {totalReceived.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <TrendingDown className="w-5 h-5 text-[#FF6B6B] mx-auto mb-2" />
              <p className="text-xs text-gray-600 mb-1">Pago</p>
              <p className="text-lg font-bold text-[#FF6B6B]">R$ {totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 text-orange-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 mb-1">Pendente</p>
              <p className="text-lg font-bold text-orange-500">R$ {totalPending.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">Todos</button>
            <button onClick={() => setFilter('paid')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'paid' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">Pagos</button>
            <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">Pendentes</button>
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
            {pendingGrouped.map((group) => (
              <div key={group.groupId} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-800">{group.groupName}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-500">Pendentes</span>
                </div>
                <div className="space-y-2">
                  {group.items.map((payment) => {
                    const canMarkAsReceived = myId === payment.toUserId
                    return (
                      <div key={payment.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-800">
                            {payment.from} {'->'} {payment.to}
                          </p>
                          <p className="text-sm font-semibold text-gray-800">R$ {payment.amount.toFixed(2)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleMarkAsReceived(payment)}
                            disabled={!canMarkAsReceived || savingId === payment.id}
                            className="py-2 bg-[#5BC5A7] text-white rounded-lg font-medium hover:bg-[#4AB396] disabled:opacity-60 disabled:cursor-not-allowed"
                            type="button"
                            title={canMarkAsReceived ? 'Marcar como recebido' : 'Somente quem recebeu o pagamento pode confirmar'}
                          >
                            {savingId === payment.id ? 'Salvando...' : 'Marcar como recebido'}
                          </button>
                          <button
                            onClick={() => {
                              setChargeTarget(payment)
                              setPixCopyPaste('')
                            }}
                            className="py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
                            type="button"
                          >
                            Cobrar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {paidList.map((payment) => (
              <div key={payment.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-medium text-gray-800">{payment.description}</h3>
                      <CheckCircle className="w-4 h-4 text-[#5BC5A7]" />
                    </div>
                    <p className="text-sm text-gray-600">{payment.from} {'->'} {payment.to}</p>
                    <p className="text-xs text-gray-500 mt-1">{payment.groupName}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-semibold text-gray-800">R$ {payment.amount.toFixed(2)}</p>
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

      {chargeTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4 max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Cobrar pagamento</h3>
              <button onClick={() => setChargeTarget(null)} type="button" className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm space-y-1">
              <p><span className="text-gray-500">Grupo:</span> <span className="font-medium text-gray-800">{chargeTarget.groupName}</span></p>
              <p><span className="text-gray-500">Valor:</span> <span className="font-medium text-gray-800">R$ {chargeTarget.amount.toFixed(2)}</span></p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">Mensagem de cobranca</p>
              <input
                type="text"
                value={pixCopyPaste}
                onChange={(e) => setPixCopyPaste(e.target.value)}
                placeholder="Cole aqui o PIX copia e cola (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
              />
              <p className="text-sm text-gray-700 whitespace-pre-line">{buildChargeMessage(chargeTarget.groupName, chargeTarget.amount, pixCopyPaste)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => copyChargeMessage(chargeTarget)}
                className="py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
                type="button"
              >
                Copiar mensagem
              </button>
              <button
                onClick={() => shareChargeMessage(chargeTarget)}
                className="py-2 bg-gray-800 text-white rounded-lg font-medium"
                type="button"
              >
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl w-full mx-auto px-4 py-4">
        <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
          <p className="text-xs text-gray-500">Espaco reservado para anuncio</p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

