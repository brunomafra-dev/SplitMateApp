'use client'

import { ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'

type GroupRow = {
  id: string
  name: string
  participants?: any
}

type TransactionRow = {
  id: string
  group_id: string
  value: number
  payer_id: string
  created_at: string
}

type PaymentRow = {
  id: string
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at: string
}

type ActivityItem = {
  id: string
  type: 'expense' | 'settle'
  description: string
  groupName: string
  createdAt: string
}

function formatBRL(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)

  if (sec < 60) return 'agora'
  if (min < 60) return `${min} min atrás`
  if (hr < 24) return `${hr} horas atrás`
  if (day === 1) return '1 dia atrás'
  if (day < 30) return `${day} dias atrás`
  return d.toLocaleDateString('pt-BR')
}

export default function Activity() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])

  useEffect(() => {
    const run = async () => {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      setMyId(session.user.id)

      const { data: g } = await supabase.from('groups').select('id,name,participants')
      setGroups((g as any) || [])

      const { data: t } = await supabase
        .from('transactions')
        .select('id,group_id,value,payer_id,created_at')
        .order('created_at', { ascending: false })
        .limit(30)

      setTransactions(
        ((t as any) || []).map((x: any) => ({
          ...x,
          value: Number(x.value) || 0,
        }))
      )

      const { data: p } = await supabase
        .from('payments')
        .select('id,group_id,from_user,to_user,amount,created_at')
        .order('created_at', { ascending: false })
        .limit(30)

      setPayments(
        ((p as any) || []).map((x: any) => ({
          ...x,
          amount: Number(x.amount) || 0,
        }))
      )

      setLoading(false)
    }

    run()
  }, [router])

  const groupMap = useMemo(() => {
    const m = new Map<string, GroupRow>()
    groups.forEach((g) => m.set(g.id, g))
    return m
  }, [groups])

  const userNameFromGroup = (groupId: string, userId: string) => {
    const group = groupMap.get(groupId)
    const participants: any[] = Array.isArray(group?.participants) ? group!.participants : []
    const found = participants.find((p) => String(p?.id ?? p?.user_id) === String(userId))
    return found?.name || found?.email || null
  }

  const activities: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = []

    // Expenses
    for (const tx of transactions) {
      const group = groupMap.get(tx.group_id)
      const groupName = group?.name || 'Grupo'

      const payerName =
        myId && String(tx.payer_id) === String(myId)
          ? 'Você'
          : userNameFromGroup(tx.group_id, tx.payer_id) || 'Alguém'

      items.push({
        id: `tx_${tx.id}`,
        type: 'expense',
        description: `${payerName} pagou ${formatBRL(tx.value)}`,
        groupName,
        createdAt: tx.created_at,
      })
    }

    // Settles (payments)
    for (const pay of payments) {
      const group = groupMap.get(pay.group_id)
      const groupName = group?.name || 'Grupo'

      const fromName =
        myId && String(pay.from_user) === String(myId)
          ? 'Você'
          : userNameFromGroup(pay.group_id, pay.from_user) || 'Alguém'

      const toName =
        myId && String(pay.to_user) === String(myId)
          ? 'você'
          : userNameFromGroup(pay.group_id, pay.to_user) || 'alguém'

      items.push({
        id: `pay_${pay.id}`,
        type: 'settle',
        description: `${fromName} pagou ${toName} ${formatBRL(pay.amount)}`,
        groupName,
        createdAt: pay.created_at,
      })
    }

    // Ordena por data desc
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return items.slice(0, 30)
  }, [transactions, payments, groupMap, myId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-gray-600 text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-gray-600 hover:text-gray-800" aria-label="Voltar">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Atividade</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {activities.length === 0 ? (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-gray-700 font-medium">Sem atividades por enquanto</p>
            <p className="text-sm text-gray-500 mt-1">
              Quando alguém adicionar gastos ou pagamentos, eles aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#5BC5A7]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#5BC5A7]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{activity.groupName}</p>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(activity.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Ad Space Placeholder */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
          <p className="text-xs text-gray-500">Espaço reservado para anúncio</p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
