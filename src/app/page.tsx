'use client'

import { Plus, User, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import type { BalancePayment, BalanceTransaction } from '@/lib/balance'
import { fetchGroupMembersMap, type GroupMember } from '@/lib/group-members'

interface Member {
  id: string
  name: string
  avatar?: string
}

interface GroupRow {
  id: string
  name: string
}

interface TransactionRow extends BalanceTransaction {
  splits?: any
  status?: string
}

interface PaymentRow extends BalancePayment {}

interface GroupUI {
  id: string
  name: string
  totalSpent: number
  balance: number
  participants: number
  members?: Member[]
}

export default function Home() {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupUI[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const getInitials = (name: string) => {
    const parts = String(name || '').trim().split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return String(name || '').substring(0, 2).toUpperCase()
  }

  const renderMemberAvatars = (members?: Member[], maxDisplay: number = 4) => {
    if (!members || members.length === 0) return null

    const displayMembers = members.slice(0, maxDisplay)
    const remaining = members.length - maxDisplay

    return (
      <div className="flex items-center -space-x-2">
        {displayMembers.map((member, index) => (
          <div
            key={member.id}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] flex items-center justify-center text-white text-xs font-medium border-2 border-white"
            style={{ zIndex: displayMembers.length - index }}
            title={member.name}
          >
            {member.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatar}
                alt={member.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(member.name)
            )}
          </div>
        ))}

        {remaining > 0 && (
          <div
            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white"
            style={{ zIndex: 0 }}
            title={`+${remaining}`}
          >
            +{remaining}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setLoading(false)
        router.replace('/login')
        return
      }

      const myId = session.user.id

      try {
        localStorage.removeItem('divideai_groups')
      } catch {}

      const { data: groupRows, error: gErr } = await supabase
        .from('groups')
        .select('id,name')

      if (gErr) {
        console.error('Erro ao carregar groups:', gErr.message)
        setGroups([])
        setTotalBalance(0)
        setLoading(false)
        return
      }

      let txRows: any[] | null = null
      let tErr: any = null

      const txWithAll = await supabase
        .from('transactions')
        .select('id,group_id,value,payer_id,splits,status')

      if (txWithAll.error) {
        const txWithSplits = await supabase
          .from('transactions')
          .select('id,group_id,value,payer_id,splits')

        if (txWithSplits.error) {
          const txMinimal = await supabase
            .from('transactions')
            .select('id,group_id,value,payer_id')

          txRows = txMinimal.data
          tErr = txMinimal.error
        } else {
          txRows = txWithSplits.data
          tErr = null
        }
      } else {
        txRows = txWithAll.data
        tErr = null
      }

      if (tErr) {
        console.error('Erro ao carregar transactions:', tErr.message)
      }

      const { data: payRows, error: pErr } = await supabase
        .from('payments')
        .select('group_id,from_user,to_user,amount')

      if (pErr) {
        console.error('Erro ao carregar payments:', pErr.message)
      }

      const safeGroups: GroupRow[] = (groupRows as any) || []
      const membersByGroup = await fetchGroupMembersMap(safeGroups.map((group) => group.id))

      const safeTx: TransactionRow[] = ((txRows as any) || []).map((t: any) => ({
        ...t,
        value: Number(t.value) || 0,
      }))

      const safePayments: PaymentRow[] = ((payRows as any) || []).map((p: any) => ({
        ...p,
        amount: Number(p.amount) || 0,
      }))

      let global = 0

      const uiGroups: GroupUI[] = safeGroups.map((g) => {
        const members = (membersByGroup.get(g.id) || []) as GroupMember[]
        const participantsCount = members.length
        const currentParticipantIds = members.map((m) => m.id).filter(Boolean)

        const groupTx = safeTx
          .filter((tx) => tx.group_id === g.id)
          .map((tx) => ({
            ...tx,
            participants: currentParticipantIds,
          }))

        const groupPayments = safePayments.filter((payment) => payment.group_id === g.id)
        const totalSpent = groupTx.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0)

        const pendingByKey = new Map<string, number>()
        for (const tx of groupTx) {
          if (String(tx.status || '').toLowerCase() === 'paid') continue
          const txValue = Number(tx.value) || 0
          if (txValue <= 0) continue
          if (!currentParticipantIds.includes(myId)) continue
          if (currentParticipantIds.length === 0) continue

          const share = txValue / currentParticipantIds.length
          if (share <= 0) continue

          if (String(tx.payer_id) === String(myId)) {
            for (const debtorId of currentParticipantIds.filter((pid) => String(pid) !== String(myId))) {
              const key = `${g.id}|${debtorId}|${myId}`
              pendingByKey.set(key, (pendingByKey.get(key) || 0) + share)
            }
          } else {
            const key = `${g.id}|${myId}|${tx.payer_id}`
            pendingByKey.set(key, (pendingByKey.get(key) || 0) + share)
          }
        }

        const paidByKey = new Map<string, number>()
        for (const p of groupPayments) {
          const key = `${p.group_id}|${p.from_user}|${p.to_user}`
          paidByKey.set(key, (paidByKey.get(key) || 0) + (Number(p.amount) || 0))
        }

        let pendingBalance = 0
        for (const [key, amount] of pendingByKey.entries()) {
          const paidAmount = paidByKey.get(key) || 0
          const outstanding = Math.max(0, amount - paidAmount)
          if (outstanding <= 0.009) continue

          const [, fromUser, toUser] = key.split('|')
          if (String(toUser) === String(myId)) pendingBalance += outstanding
          else if (String(fromUser) === String(myId)) pendingBalance -= outstanding
        }

        const normalizedPending = Math.abs(pendingBalance) <= 0.009 ? 0 : Number(pendingBalance.toFixed(2))
        global += normalizedPending

        return {
          id: g.id,
          name: g.name,
          totalSpent,
          balance: normalizedPending,
          participants: participantsCount,
          members,
        }
      })

      const normalizedGlobal = Math.abs(global) <= 0.009 ? 0 : Number(global.toFixed(2))
      setGroups(uiGroups)
      setTotalBalance(normalizedGlobal)
      setLoading(false)
    }

    run()

    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        run()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        run()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        run()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        run()
      })
      .subscribe()

    const onFocus = () => {
      run()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        run()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-gray-600 text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#5BC5A7]">Divide Ai</h1>
          <Link href="/profile">
            <div className="w-10 h-10 bg-[#5BC5A7] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#4AB396] transition-colors">
              <User className="w-6 h-6 text-white" />
            </div>
          </Link>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Saldo total</p>
            <div className="flex items-center justify-center gap-2">
              {totalBalance === 0 ? (
                <>
                  <p className="text-3xl font-bold text-gray-800">R$ 0,00</p>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">zerado</span>
                </>
              ) : totalBalance > 0 ? (
                <>
                  <TrendingUp className="w-6 h-6 text-[#5BC5A7]" />
                  <p className="text-3xl font-bold text-[#5BC5A7]">R$ {totalBalance.toFixed(2)}</p>
                  <span className="text-sm text-[#5BC5A7] bg-green-50 px-3 py-1 rounded-full">te devem</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-6 h-6 text-[#FF6B6B]" />
                  <p className="text-3xl font-bold text-[#FF6B6B]">R$ {Math.abs(totalBalance).toFixed(2)}</p>
                  <span className="text-sm text-[#FF6B6B] bg-red-50 px-3 py-1 rounded-full">voce deve</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="bg-gray-100 rounded-lg p-3 text-center border-2 border-dashed border-gray-300">
            <p className="text-xs text-gray-500">Espaco reservado para anuncio</p>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {groups.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum grupo ainda</h3>
            <p className="text-gray-600 mb-6">Crie seu primeiro grupo para comecar a dividir gastos</p>
            <Link href="/create-group">
              <button className="bg-[#5BC5A7] text-white px-6 py-3 rounded-lg hover:bg-[#4AB396] transition-colors" type="button">
                Criar primeiro grupo
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Seus grupos</h2>
              <span className="text-sm text-gray-600">
                {groups.length} {groups.length === 1 ? 'grupo' : 'grupos'}
              </span>
            </div>

            <div className="space-y-3">
              {groups.map((group) => (
                <Link key={group.id} href={`/group/${group.id}`}>
                  <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-800 mb-1 truncate">{group.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{group.participants} {group.participants === 1 ? 'pessoa' : 'pessoas'}</span>
                          <span>•</span>
                          <span>R$ {group.totalSpent.toFixed(2)} gasto</span>
                        </div>
                      </div>

                      <div className="text-right ml-4 shrink-0">
                        {group.balance === 0 ? (
                          <span className="text-sm text-[#5BC5A7] bg-green-50 px-3 py-1 rounded-full">pago</span>
                        ) : group.balance > 0 ? (
                          <div className="text-right">
                            <p className="text-xs text-gray-600 mb-1">te devem</p>
                            <p className="text-lg font-semibold text-[#5BC5A7]">R$ {group.balance.toFixed(2)}</p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-xs text-gray-600 mb-1">voce deve</p>
                            <p className="text-lg font-semibold text-[#FF6B6B]">R$ {Math.abs(group.balance).toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      {renderMemberAvatars(group.members, 4)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <Link href="/create-group">
        <button className="fixed right-6 w-16 h-16 bg-[#5BC5A7] rounded-full flex items-center justify-center shadow-lg hover:bg-[#4AB396] transition-all hover:scale-110 z-40 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" type="button">
          <Plus className="w-8 h-8 text-white" />
        </button>
      </Link>

      <BottomNav />
    </div>
  )
}
