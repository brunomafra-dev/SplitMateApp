'use client'

import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import { fetchGroupMembersMap, type GroupMember } from '@/lib/group-members'
import UserAvatar from '@/components/user-avatar'
import { computePendingEdges } from '@/lib/pending-balances'
import { fromCents, toCents } from '@/lib/money'
import { auditDatabaseSecurity, type SecurityAuditReport } from '@/lib/security-audit'
import { usePremium } from '@/hooks/use-premium'
import { useAuth } from '@/context/AuthContext'
import AppBrand from '@/components/app-brand'
import LandingPage from '@/components/marketing/landing-page'

interface Member {
  id: string
  name: string
  avatarKey?: string
  isPremium?: boolean
}

interface GroupRow {
  id: string
  name: string
}

interface TransactionRow {
  id: string
  group_id: string
  value: number
  payer_id: string
  participants?: string[]
  splits?: Record<string, number>
  status?: string
  description?: string
  created_at?: string
}

interface PaymentRow {
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at?: string
}

interface LegacyTransactionRow extends TransactionRow {
  splits?: any
  status?: string
}

interface GroupUI {
  id: string
  name: string
  totalSpent: number
  balance: number
  participants: number
  members?: Member[]
}

type HomeViewCache = {
  groups: GroupUI[]
  totalBalance: number
  showMyBalance: boolean
  myAvatarKey: string
  myDisplayName: string
  myIsPremium: boolean
  totalToReceive: number
  totalToPay: number
}

let homeViewCache: HomeViewCache | null = null

export default function Home() {
  const router = useRouter()
  const { isPremium } = usePremium()
  const { user, loading: authLoading } = useAuth()
  const [isNativeContainer, setIsNativeContainer] = useState(false)
  const [groups, setGroups] = useState<GroupUI[]>(() => homeViewCache?.groups || [])
  const [totalBalance, setTotalBalance] = useState(() => homeViewCache?.totalBalance || 0)
  const [loading, setLoading] = useState(() => !homeViewCache)
  const hasLoadedOnceRef = useRef(Boolean(homeViewCache))
  const [showMyBalance, setShowMyBalance] = useState(() => homeViewCache?.showMyBalance ?? true)
  const [myAvatarKey, setMyAvatarKey] = useState(() => homeViewCache?.myAvatarKey || '')
  const [myDisplayName, setMyDisplayName] = useState(() => homeViewCache?.myDisplayName || 'Perfil')
  const [myIsPremium, setMyIsPremium] = useState(() => homeViewCache?.myIsPremium ?? false)
  const [totalToReceive, setTotalToReceive] = useState(() => homeViewCache?.totalToReceive || 0)
  const [totalToPay, setTotalToPay] = useState(() => homeViewCache?.totalToPay || 0)
  const [securityReport, setSecurityReport] = useState<SecurityAuditReport | null>(null)
  const [showSecurityIssues, setShowSecurityIssues] = useState(false)
  const securityAuditRanRef = useRef(false)
  const runInFlightRef = useRef(false)
  const rerunRequestedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = navigator.userAgent || ''
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    const isNative = /Capacitor|wv|Android.*Version\/[\d.]+/i.test(ua)
    setIsNativeContainer(Boolean(isNative && !standalone))
  }, [])

  useEffect(() => {
    if (!authLoading && !user && isNativeContainer) {
      router.replace('/login')
    }
  }, [authLoading, isNativeContainer, router, user])

  const renderMemberAvatars = (members?: Member[], maxDisplay: number = 4) => {
    if (!members || members.length === 0) return null

    const displayMembers = members.slice(0, maxDisplay)
    const remaining = members.length - maxDisplay

    return (
      <div className="flex items-center -space-x-2">
        {displayMembers.map((member, index) => (
          <div
            key={member.id}
            className="w-8 h-8 rounded-full border-2 border-white"
            style={{ zIndex: displayMembers.length - index }}
            title={member.name}
          >
            <UserAvatar name={member.name} avatarKey={member.avatarKey} isPremium={member.isPremium} className="w-full h-full" textClassName="text-[10px]" />
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
    if (authLoading) return

    const run = async (showBlockingLoading: boolean = false) => {
      if (runInFlightRef.current) {
        rerunRequestedRef.current = true
        return
      }
      runInFlightRef.current = true
      if (showBlockingLoading || !hasLoadedOnceRef.current) {
        setLoading(true)
      }
      try {
        if (!user?.id) {
          setLoading(false)
          return
        }

        const myId = user.id

        if (!securityAuditRanRef.current) {
          securityAuditRanRef.current = true
          const report = await auditDatabaseSecurity(supabase)
          setSecurityReport(report)
        }

        try {
          localStorage.removeItem('SplitMate_groups')
        } catch {}

        const { data: groupRows, error: gErr } = await supabase
          .from('groups')
          .select('id,name')

        if (gErr) {
          console.error('Erro ao carregar groups:', gErr.message)
          setGroups([])
          setTotalBalance(0)
          return
        }

      const txAttempt = await supabase.from('transactions').select('*')
      const txRows = (txAttempt.data as any[] | null) ?? []
      const tErr = txAttempt.error

      if (tErr) {
        console.error('Erro ao carregar transactions:', {
          code: tErr.code,
          message: tErr.message,
          details: tErr.details,
          hint: tErr.hint,
        })
      }

      const { data: payRows, error: pErr } = await supabase
        .from('payments')
        .select('group_id,from_user,to_user,amount,created_at')

      if (pErr) {
        console.error('Erro ao carregar payments:', pErr.message)
      }

        let myProfile: any = null
        const myProfilePreferred = await supabase
          .from('profiles')
          .select('privacy_show_balance,username,full_name,avatar_key,is_premium')
          .eq('id', myId)
          .maybeSingle()

        if (myProfilePreferred.error) {
          const myProfileFallback = await supabase
            .from('profiles')
            .select('privacy_show_balance,username,full_name')
            .eq('id', myId)
            .maybeSingle()
          myProfile = myProfileFallback.data
        } else {
          myProfile = myProfilePreferred.data
        }
        setShowMyBalance(Boolean(myProfile?.privacy_show_balance ?? true))
        setMyAvatarKey(String(myProfile?.avatar_key || ''))
        setMyDisplayName(String(myProfile?.username || myProfile?.full_name || 'Perfil'))
        setMyIsPremium(Boolean(myProfile?.is_premium))

        const safeGroups: GroupRow[] = (groupRows as any) || []
        const allowedGroupIds = new Set(safeGroups.map((g) => g.id))
        const membersByGroup = await fetchGroupMembersMap(safeGroups.map((group) => group.id), myId)

        const safeTx: LegacyTransactionRow[] = ((txRows as any) || [])
          .filter((t: any) => allowedGroupIds.has(String(t.group_id || '')))
          .map((t: any) => ({
          ...t,
          value: Number(t.value) || 0,
        }))

        const safePayments: PaymentRow[] = ((payRows as any) || [])
          .filter((p: any) => allowedGroupIds.has(String(p.group_id || '')))
          .map((p: any) => ({
          ...p,
          amount: Number(p.amount) || 0,
        }))

        const pendingEdges = computePendingEdges(
          safeTx.map((tx) => ({
            id: tx.id,
            group_id: tx.group_id,
            payer_id: tx.payer_id,
            value: Number(tx.value) || 0,
            description: tx.description,
            status: tx.status,
            created_at: tx.created_at,
            participants: Array.isArray(tx.participants) ? tx.participants : undefined,
            splits: (tx as any).splits as Record<string, number> | undefined,
          })),
          safePayments.map((p) => ({
            group_id: p.group_id,
            from_user: p.from_user,
            to_user: p.to_user,
            amount: Number(p.amount) || 0,
            created_at: (p as any).created_at as string | undefined,
          }))
        )

        let globalCents = 0
        let receiveTotalCents = 0
        let payTotalCents = 0
        const balanceByGroupCents = new Map<string, number>()

        for (const edge of pendingEdges) {
          const edgeCents = toCents(edge.amount)
          if (edge.toUserId === myId) {
            balanceByGroupCents.set(edge.groupId, (balanceByGroupCents.get(edge.groupId) || 0) + edgeCents)
            receiveTotalCents += edgeCents
          } else if (edge.fromUserId === myId) {
            balanceByGroupCents.set(edge.groupId, (balanceByGroupCents.get(edge.groupId) || 0) - edgeCents)
            payTotalCents += edgeCents
          }
        }

        const uiGroups: GroupUI[] = safeGroups.map((g) => {
        const members = (membersByGroup.get(g.id) || []) as GroupMember[]
        const participantsCount = members.length
        const groupTx = safeTx.filter((tx) => tx.group_id === g.id)

        const totalSpent = groupTx.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0)
        const pendingBalanceCents = balanceByGroupCents.get(g.id) || 0
        const normalizedPending = pendingBalanceCents === 0 ? 0 : fromCents(pendingBalanceCents)
        globalCents += pendingBalanceCents

        return {
          id: g.id,
          name: g.name,
          totalSpent,
          balance: normalizedPending,
          participants: participantsCount,
          members,
        }
      })

        const normalizedGlobal = globalCents === 0 ? 0 : fromCents(globalCents)
        setGroups(uiGroups)
        setTotalBalance(normalizedGlobal)
        const nextToReceive = fromCents(receiveTotalCents)
        const nextToPay = fromCents(payTotalCents)
        setTotalToReceive(nextToReceive)
        setTotalToPay(nextToPay)
        homeViewCache = {
          groups: uiGroups,
          totalBalance: normalizedGlobal,
          showMyBalance: Boolean(myProfile?.privacy_show_balance ?? true),
          myAvatarKey: String(myProfile?.avatar_key || ''),
          myDisplayName: String(myProfile?.username || myProfile?.full_name || 'Perfil'),
          myIsPremium: Boolean(myProfile?.is_premium),
          totalToReceive: nextToReceive,
          totalToPay: nextToPay,
        }
      } catch (error) {
        console.error('home.load-unhandled-error', error)
        setGroups([])
        setTotalBalance(0)
        setTotalToReceive(0)
        setTotalToPay(0)
      } finally {
        runInFlightRef.current = false
        hasLoadedOnceRef.current = true
        setLoading(false)
        if (rerunRequestedRef.current) {
          rerunRequestedRef.current = false
          void run(false)
        }
      }
    }

    void run(!homeViewCache)

    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        run(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        run(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        run(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        run(false)
      })
      .subscribe()

    const onFocus = () => {
      run(false)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        run(false)
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [authLoading, router, user?.id])

  if (!authLoading && !user && isNativeContainer) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-[#5BC5A7] animate-spin" aria-label="Carregando" />
      </div>
    )
  }

  if (!authLoading && !user) {
    return <LandingPage />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-gray-600 text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden page-fade">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <AppBrand />
          <Link href="/profile">
            <div className="cursor-pointer hover:opacity-90 transition-opacity">
              <UserAvatar name={myDisplayName} avatarKey={myAvatarKey} isPremium={myIsPremium} className="w-10 h-10" textClassName="text-xs" />
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
                  <p className="text-3xl font-bold text-gray-800">{showMyBalance ? 'R$ 0,00' : 'Oculto'}</p>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">zerado</span>
                </>
              ) : totalBalance > 0 ? (
                <>
                  <TrendingUp className="w-6 h-6 text-[#5BC5A7]" />
                  <p className="text-3xl font-bold text-[#5BC5A7]">{showMyBalance ? `R$ ${totalBalance.toFixed(2)}` : 'Oculto'}</p>
                  <span className="text-sm text-[#5BC5A7] bg-green-50 px-3 py-1 rounded-full">te devem</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-6 h-6 text-[#FF6B6B]" />
                  <p className="text-3xl font-bold text-[#FF6B6B]">{showMyBalance ? `R$ ${Math.abs(totalBalance).toFixed(2)}` : 'Oculto'}</p>
                  <span className="text-sm text-[#FF6B6B] bg-red-50 px-3 py-1 rounded-full">Você deve</span>
                </>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-green-100 dark:border-emerald-800/70 bg-green-50 dark:bg-emerald-950/45 p-3 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">A Receber</p>
                <p className="text-sm font-semibold text-[#5BC5A7]">{showMyBalance ? `R$ ${totalToReceive.toFixed(2)}` : 'Oculto'}</p>
              </div>
              <div className="rounded-lg border border-red-100 dark:border-rose-800/70 bg-red-50 dark:bg-rose-950/45 p-3 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">A Pagar</p>
                <p className="text-sm font-semibold text-[#FF6B6B]">{showMyBalance ? `R$ ${totalToPay.toFixed(2)}` : 'Oculto'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isPremium && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="bg-gray-100 rounded-lg p-3 text-center border-2 border-dashed border-gray-300">
              <p className="text-xs text-gray-500">Espaco reservado para anuncio</p>
            </div>
          </div>
        </div>
      )}

      {securityReport && !securityReport.safe && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="rounded-lg border border-amber-200 bg-amber-100/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-amber-900">Atencao: problemas de seguranca detectados.</p>
                <button
                  type="button"
                  onClick={() => setShowSecurityIssues((prev) => !prev)}
                  className="tap-target pressable px-3 py-1.5 text-xs rounded-lg border border-amber-300 text-amber-900 hover:bg-amber-200/60"
                >
                  {showSecurityIssues ? 'Ocultar relatório' : 'Ver relatório de seguranca'}
                </button>
              </div>

              {showSecurityIssues && (
                <div className="mt-3 space-y-2">
                  {securityReport.issues.map((issue, index) => (
                    <div key={`${issue.type}-${issue.table || 'no-table'}-${index}`} className="rounded-md bg-white/80 border border-amber-200 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-900">{issue.type}</p>
                      {issue.table && <p className="text-xs text-amber-800">Tabela: {issue.table}</p>}
                      <p className="text-xs text-amber-800">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {groups.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum grupo ainda</h3>
            <p className="text-gray-600 mb-6">Crie seu primeiro grupo para comecar a dividir gastos</p>
            <Link href="/create-group">
              <button className="tap-target pressable bg-[#5BC5A7] text-white px-6 py-3 rounded-lg hover:bg-[#4AB396] transition-colors" type="button">
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
                  <div className="surface-card p-4 surface-card-hover cursor-pointer">
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
                            <p className="text-lg font-semibold text-[#5BC5A7]">{showMyBalance ? `R$ ${group.balance.toFixed(2)}` : 'Oculto'}</p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-xs text-gray-600 mb-1">Você deve</p>
                            <p className="text-lg font-semibold text-[#FF6B6B]">{showMyBalance ? `R$ ${Math.abs(group.balance).toFixed(2)}` : 'Oculto'}</p>
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
        <button className="fixed right-6 w-16 h-16 bg-[#5BC5A7] rounded-full flex items-center justify-center shadow-lg hover:bg-[#4AB396] pressable transition-all hover:scale-110 z-40 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" type="button">
          <Plus className="w-8 h-8 text-white" />
        </button>
      </Link>

      <BottomNav />
    </div>
  )
}


