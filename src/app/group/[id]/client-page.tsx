'use client'



import { ArrowLeft, Plus, TrendingUp, TrendingDown, Settings, UserPlus, Copy, X, ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { generateSecureInviteToken } from '@/lib/invites'
import { buildInviteLink } from '@/lib/site-url'
import BottomNav from '@/components/ui/bottom-nav'
import UserAvatar from '@/components/user-avatar'
import { computePendingEdges } from '@/lib/pending-balances'
import { fromCents, toCents } from '@/lib/money'
import { normalizePersistedSplits } from '@/lib/transaction-splits'
import SuggestedSettlements from '@/components/group/suggested-settlements'
import { buildBalancesFromEdges, simplifyDebts, type SimplifiedPayment } from '@/lib/debt-simplifier'
import DebtBreakdownModal from '@/components/debt/debt-breakdown-modal'
import { auditGroupFinancialIntegrity, type FinancialAuditReport } from '@/lib/financial-audit'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { usePremium } from '@/hooks/use-premium'

interface Participant {
  id: string
  user_id?: string
  role?: string
  display_name?: string
  name: string
  avatar_key?: string
  is_premium?: boolean
  email?: string
}

interface TransactionRow {
  id: string
  group_id: string
  value: number
  payer_id: string
  participants?: string[] | null
  splits?: Record<string, number> | null
  status?: string | null
  description: string
  created_at?: string
}

interface PaymentRow {
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at?: string
}
interface ParticipantUserRow {
  id?: string
  user_id?: string
  display_name?: string
  role?: string
}

interface GroupRow {
  id: string
  name: string
  category: string
  owner_id?: string
}

interface Group {
  id: string
  name: string
  category: string
  totalSpent: number
  balance: number
  participants: number
  participantsList: Participant[]
  transactions: Array<{
    id: string
    description: string
    amount: number
    payerId: string
    payerName: string
    date: string
    participants: string[]
    status?: string
    isPaid?: boolean
  }>
}

type ParticipantSummary = {
  userId: string
  name: string
  totalPaid: number
  totalShare: number
  pendingToReceive: number
  pendingToPay: number
  netPending: number
}

type GroupReport = {
  totalSpent: number
  totalSettled: number
  totalPending: number
  participants: ParticipantSummary[]
}

type PersonBalanceRow = {
  userId: string
  name: string
  avatarKey?: string
  isPremium?: boolean
  amountCents: number
}

type DebtBreakdownTarget = {
  debtorId: string
  creditorId: string
  debtorName: string
  debtorAvatarKey?: string
  debtorIsPremium?: boolean
}

type GroupPageCacheEntry = {
  group: Group | null
  report: GroupReport | null
  isOwner: boolean
  showMyBalance: boolean
  suggestedSettlements: SimplifiedPayment[]
  personBalances: PersonBalanceRow[]
  auditReport: FinancialAuditReport
  currentUserId: string | null
}

const groupPageCache = new Map<string, GroupPageCacheEntry>()

export default function GroupPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string
  const cachedView = groupPageCache.get(groupId)

  const [group, setGroup] = useState<Group | null>(() => cachedView?.group ?? null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(() => !cachedView)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => cachedView?.currentUserId ?? null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [showParticipantModal, setShowParticipantModal] = useState(false)
  const [showParticipantsListModal, setShowParticipantsListModal] = useState(false)
  const [participantsListFeedback, setParticipantsListFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [manualParticipantName, setManualParticipantName] = useState('')
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [isOwner, setIsOwner] = useState(() => cachedView?.isOwner ?? false)
  const [showMyBalance, setShowMyBalance] = useState(() => cachedView?.showMyBalance ?? true)
  const { isPremium } = usePremium()
  const [report, setReport] = useState<GroupReport | null>(() => cachedView?.report ?? null)
  const [reportFeedback, setReportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isReportExpanded, setIsReportExpanded] = useState(false)
  const [suggestedSettlements, setSuggestedSettlements] = useState<SimplifiedPayment[]>(() => cachedView?.suggestedSettlements ?? [])
  const [registeringSuggestedSettlements, setRegisteringSuggestedSettlements] = useState(false)
  const [personBalances, setPersonBalances] = useState<PersonBalanceRow[]>(() => cachedView?.personBalances ?? [])
  const [debtBreakdownTarget, setDebtBreakdownTarget] = useState<DebtBreakdownTarget | null>(null)
  const [auditReport, setAuditReport] = useState<FinancialAuditReport>(() => cachedView?.auditReport ?? { valid: true, issues: [] })
  const [showAuditIssues, setShowAuditIssues] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const loadGroup = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false)
      return
    }

    if (!groupPageCache.get(groupId)) {
      setLoading(true)
    }

    const groupSelectCandidates = [
      'id,name,category,owner_id',
      'id,name,owner_id',
      'id,name,category',
      'id,name',
    ]

    let groupRow: GroupRow | null = null
    let groupError: any = null

    for (const selectClause of groupSelectCandidates) {
      const attempt = await supabase.from('groups').select(selectClause).eq('id', groupId).single()
      if (!attempt.error && attempt.data) {
        groupRow = attempt.data as unknown as GroupRow
        groupError = null
        break
      }
      groupError = attempt.error
    }

    if (groupError || !groupRow) {
      console.error('group.load-error', {
        code: groupError?.code,
        message: groupError?.message,
        details: groupError?.details,
        hint: groupError?.hint,
        groupId,
      })
      setLoading(false)
      router.replace('/')
      return
    }

    const participantSelectCandidates = [
      'id,user_id,display_name,role',
      'id,user_id,role',
      'user_id,role',
    ]
    let participantRows: ParticipantUserRow[] | null = null
    let participantsError: any = null

    for (const selectClause of participantSelectCandidates) {
      const attempt = await supabase
        .from('participants')
        .select(selectClause)
        .eq('group_id', groupId)

      if (!attempt.error) {
        participantRows = (attempt.data as ParticipantUserRow[] | null) ?? []
        participantsError = null
        break
      }
      participantsError = attempt.error
    }

    if (participantsError) {
      console.error('group.participants-load-error', participantsError)
    }

    const participantRowsSafe = (participantRows ?? [])
    const legacyParticipantToUserId = new Map<string, string>()
    for (const row of participantRowsSafe) {
      const participantId = String(row.id || '').trim()
      const userId = String(row.user_id || '').trim()
      if (participantId && userId) {
        legacyParticipantToUserId.set(participantId, userId)
      }
    }
    const participantUsers = participantRowsSafe
      .map((row) => String(row.user_id || '').trim())
      .filter(Boolean)

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('privacy_show_balance')
      .eq('id', currentUserId)
      .maybeSingle()
    setShowMyBalance(Boolean(myProfile?.privacy_show_balance ?? true))

    let profileMap = new Map<string, { username?: string; full_name?: string; privacy_profile_visible?: boolean; avatar_key?: string; is_premium?: boolean }>()
    if (participantUsers.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id,username,full_name,privacy_profile_visible,avatar_key,is_premium')
        .in('id', participantUsers)

      if (profilesError) {
        console.error('group.profiles-load-error', profilesError)
      } else {
        for (const row of profileRows ?? []) {
          const id = String((row as { id?: string }).id || '').trim()
          if (!id) continue
          profileMap.set(id, {
            username: String((row as { username?: string }).username || '').trim(),
            full_name: String((row as { full_name?: string }).full_name || '').trim(),
            privacy_profile_visible: Boolean((row as { privacy_profile_visible?: boolean }).privacy_profile_visible),
            avatar_key: String((row as { avatar_key?: string }).avatar_key || '').trim(),
            is_premium: Boolean((row as { is_premium?: boolean }).is_premium),
          })
        }
      }
    }

    const tableParticipants: Participant[] = participantRowsSafe.map((row) => {
      const participantId = String(row.id || row.user_id || '').trim()
      const userId = String(row.user_id || '').trim()
      const manualName = String(row.display_name || '').trim()

      if (userId) {
        const profile = profileMap.get(userId)
        const isSelf = userId === String(currentUserId)
        const canShow = Boolean(profile?.privacy_profile_visible || isSelf)
        const display = String(canShow ? (profile?.username || profile?.full_name || 'usuario') : 'Participante').trim()
        return {
          id: participantId || userId,
          user_id: userId,
          role: String(row.role || 'member'),
          name: display || 'usuario',
          display_name: display || 'usuario',
          avatar_key: canShow ? (profile?.avatar_key || '') : '',
          is_premium: canShow ? Boolean(profile?.is_premium) : false,
        }
      }

      return {
        id: participantId || 'manual-unknown',
        role: String(row.role || 'member'),
        name: manualName || 'Participante',
        display_name: manualName || 'Participante',
        avatar_key: '',
        is_premium: false,
      }
    })

    const participantsList: Participant[] = tableParticipants

    const { data: txRows, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (txError) {
      console.error('group.transactions-load-error', {
        code: txError?.code,
        message: txError?.message,
        details: txError?.details,
        hint: txError?.hint,
        groupId,
      })
    }

    const { data: payRows, error: payError } = await supabase
      .from('payments')
      .select('group_id,from_user,to_user,amount,created_at')
      .eq('group_id', groupId)

    if (payError) {
      console.error('group.payments-load-error', payError)
    }

    let { data: myRoleRow, error: myRoleError } = await supabase
      .from('participants')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .maybeSingle()

    if (myRoleError) {
      console.error('group.role-load-error', myRoleError)
    }

    if (!myRoleRow && String(groupRow.owner_id || '') === currentUserId) {
      const { error: ownerInsertError } = await supabase.from('participants').insert({
        group_id: groupId,
        user_id: currentUserId,
        role: 'owner',
      })

      if (ownerInsertError && ownerInsertError.code !== '23505') {
        console.error('group.owner-participant-repair-error', ownerInsertError)
      } else {
        const { data: repairedRoleRow, error: repairedRoleError } = await supabase
          .from('participants')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', currentUserId)
          .maybeSingle()

        if (repairedRoleError) {
          console.error('group.role-reload-error', repairedRoleError)
        } else {
          myRoleRow = repairedRoleRow
        }
      }
    }

    const safeTx: TransactionRow[] = ((txRows as TransactionRow[] | null) ?? []).map((tx) => {
      const rawPayerId = String(tx.payer_id || '').trim()
      const payerId = legacyParticipantToUserId.get(rawPayerId) || rawPayerId
      const rawSplits = (tx.splits && typeof tx.splits === 'object' ? tx.splits : {}) as Record<string, number>
      const normalizedSplits = Object.entries(rawSplits).reduce<Record<string, number>>((acc, [rawId, rawAmount]) => {
        const key = legacyParticipantToUserId.get(String(rawId || '').trim()) || String(rawId || '').trim()
        if (!key) return acc
        const amount = Number(rawAmount) || 0
        acc[key] = (acc[key] || 0) + amount
        return acc
      }, {})
      const normalizedParticipants = Array.isArray(tx.participants)
        ? Array.from(
            new Set(
              tx.participants
                .map((id) => {
                  const rawId = String(id || '').trim()
                  return legacyParticipantToUserId.get(rawId) || rawId
                })
                .filter(Boolean)
            )
          )
        : []

      return {
        ...tx,
        value: Number(tx.value) || 0,
        payer_id: payerId,
        description: String(tx.description || ''),
        created_at: tx.created_at || new Date().toISOString(),
        status: String(tx.status || ''),
        participants: normalizedParticipants,
        splits: normalizedSplits,
      }
    })

    const safePayments: PaymentRow[] = ((payRows as PaymentRow[] | null) ?? []).map((p) => ({
      ...p,
      amount: Number(p.amount) || 0,
    }))
    const audit = auditGroupFinancialIntegrity(safeTx, participantsList, safePayments)

    const pendingEdges = computePendingEdges(
      safeTx.map((tx) => ({
        id: tx.id,
        group_id: tx.group_id,
        payer_id: tx.payer_id,
        value: Number(tx.value) || 0,
        description: tx.description,
        status: tx.status || '',
        created_at: tx.created_at,
        participants: Array.isArray(tx.participants) ? tx.participants : undefined,
        splits: (tx.splits || undefined) as Record<string, number> | undefined,
      })),
      safePayments.map((p) => ({
        group_id: p.group_id,
        from_user: p.from_user,
        to_user: p.to_user,
        amount: Number(p.amount) || 0,
        created_at: p.created_at,
      }))
    )
    const balances = buildBalancesFromEdges(pendingEdges)
    const simplified = simplifyDebts(balances)

    const pendingTxIds = new Set(pendingEdges.map((edge) => edge.txId))

    const groupTotalSpent = safeTx.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0)
    let groupBalanceCents = 0
    for (const edge of pendingEdges) {
      const cents = toCents(edge.amount)
      if (String(edge.toUserId) === String(currentUserId)) groupBalanceCents += cents
      if (String(edge.fromUserId) === String(currentUserId)) groupBalanceCents -= cents
    }

    const participantByUserId = new Map(
      participantsList.map((participant) => [String(participant.user_id || participant.id), participant] as const)
    )
    const personBalanceMap = new Map<string, number>()
    for (const edge of pendingEdges) {
      const cents = toCents(edge.amount)
      if (cents <= 0) continue

      if (String(edge.toUserId) === String(currentUserId) && String(edge.fromUserId) !== String(currentUserId)) {
        const key = String(edge.fromUserId)
        personBalanceMap.set(key, (personBalanceMap.get(key) || 0) + cents)
      } else if (String(edge.fromUserId) === String(currentUserId) && String(edge.toUserId) !== String(currentUserId)) {
        const key = String(edge.toUserId)
        personBalanceMap.set(key, (personBalanceMap.get(key) || 0) - cents)
      }
    }
    const balancesByPerson: PersonBalanceRow[] = Array.from(personBalanceMap.entries())
      .filter(([, amountCents]) => amountCents !== 0)
      .map(([userId, amountCents]) => {
        const participant = participantByUserId.get(userId)
        return {
          userId,
          name: participant?.name || 'Participante',
          avatarKey: participant?.avatar_key,
          isPremium: participant?.is_premium,
          amountCents,
        }
      })
      .sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents))

    const reportMap = new Map<string, ParticipantSummary>()
    const participantNameMap = new Map<string, string>()
    for (const participant of participantsList) {
      const userId = String(participant.user_id || participant.id)
      participantNameMap.set(userId, participant.name || 'Participante')
      reportMap.set(userId, {
        userId,
        name: participant.name || 'Participante',
        totalPaid: 0,
        totalShare: 0,
        pendingToReceive: 0,
        pendingToPay: 0,
        netPending: 0,
      })
    }

    const ensureReportRow = (userId: string) => {
      const key = String(userId || '').trim()
      if (!key) return null
      const existing = reportMap.get(key)
      if (existing) return existing
      const fallbackName = participantNameMap.get(key) || (key === String(currentUserId) ? 'Você' : 'Participante')
      const created: ParticipantSummary = {
        userId: key,
        name: fallbackName,
        totalPaid: 0,
        totalShare: 0,
        pendingToReceive: 0,
        pendingToPay: 0,
        netPending: 0,
      }
      reportMap.set(key, created)
      return created
    }

    for (const tx of safeTx) {
      const payerId = String(tx.payer_id || '')
      const normalizedSplits = normalizePersistedSplits(Number(tx.value) || 0, tx.splits)
      const splitEntries = Object.entries(normalizedSplits)

      const payerSummary = ensureReportRow(payerId)
      if (payerSummary) payerSummary.totalPaid += Number(tx.value) || 0

      for (const [participantId, share] of splitEntries) {
        const participantSummary = ensureReportRow(participantId)
        if (participantSummary) participantSummary.totalShare += share
      }
    }

    let totalPending = 0
    for (const edge of pendingEdges) {
      const amount = Number(edge.amount) || 0
      if (amount <= 0) continue
      const debtor = ensureReportRow(edge.fromUserId)
      const creditor = ensureReportRow(edge.toUserId)
      if (debtor) debtor.pendingToPay += amount
      if (creditor) creditor.pendingToReceive += amount
      totalPending += amount
    }

    const participantReport = Array.from(reportMap.values()).map((item) => ({
      ...item,
      totalPaid: Number(item.totalPaid.toFixed(2)),
      totalShare: Number(item.totalShare.toFixed(2)),
      pendingToReceive: Number(item.pendingToReceive.toFixed(2)),
      pendingToPay: Number(item.pendingToPay.toFixed(2)),
      netPending: Number((item.pendingToReceive - item.pendingToPay).toFixed(2)),
    }))

    const groupReport: GroupReport = {
      totalSpent: Number(groupTotalSpent.toFixed(2)),
      totalSettled: Number(safePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      participants: participantReport.sort((a, b) => b.pendingToReceive - a.pendingToReceive),
    }

    const transactions = safeTx.map((tx) => {
      const payer = participantsList.find((p) => String(p.user_id || p.id) === tx.payer_id)
      const txParticipantIds = Object.keys(normalizePersistedSplits(Number(tx.value) || 0, tx.splits))
      const paid = !pendingTxIds.has(tx.id)
      return {
        id: tx.id,
        description: tx.description,
        amount: tx.value,
        payerId: tx.payer_id,
        payerName: tx.payer_id === currentUserId ? 'Você' : payer?.name || 'Alguém',
        date: tx.created_at || new Date().toISOString(),
        participants: txParticipantIds,
        status: String(tx.status || '').toLowerCase(),
        isPaid: paid,
      }
    })

    if (!isMountedRef.current) return

    const groupData: Group = {
      id: groupRow.id,
      name: groupRow.name,
      category: String((groupRow as { category?: string }).category || 'other'),
      totalSpent: Number(groupTotalSpent.toFixed(2)),
      balance: fromCents(groupBalanceCents),
      participants: participantsList.length,
      participantsList,
      transactions,
    }
    const ownerFlag = String(myRoleRow?.role || '') === 'owner'
    setGroup(groupData)
    setReport(groupReport)
    setIsOwner(ownerFlag)
    setSuggestedSettlements(simplified)
    setPersonBalances(balancesByPerson)
    setAuditReport(audit)
    groupPageCache.set(groupId, {
      group: groupData,
      report: groupReport,
      isOwner: ownerFlag,
      showMyBalance: Boolean(myProfile?.privacy_show_balance ?? true),
      suggestedSettlements: simplified,
      personBalances: balancesByPerson,
      auditReport: audit,
      currentUserId,
    })
    if (audit.valid) setShowAuditIssues(false)

    setLoading(false)
  }, [currentUserId, groupId, router])

  const handleDeletePaidExpense = useCallback(async (transactionId: string, payerId: string, isPaid: boolean) => {
    if (!currentUserId) return
    if (!isPaid) return
    if (String(payerId) !== String(currentUserId)) {
      setReportFeedback({ type: 'error', text: 'Apenas quem criou o gasto pode excluir.' })
      return
    }

    const confirmed = window.confirm('Excluir este gasto quitado? Esta ação não pode ser desfeita.')
    if (!confirmed) return

    setDeletingExpenseId(transactionId)
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('group_id', groupId)
        .eq('payer_id', currentUserId)

      if (error) {
        throw error
      }

      setReportFeedback({ type: 'success', text: 'Gasto quitado excluído com sucesso.' })
      await loadGroup()
    } catch (error: any) {
      console.error('group.delete-paid-expense-error', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      })
      setReportFeedback({ type: 'error', text: error?.message || 'Erro ao excluir gasto.' })
    } finally {
      setDeletingExpenseId(null)
    }
  }, [currentUserId, groupId, loadGroup])

  const handleCreateInvite = useCallback(async () => {
    if (!currentUserId || !group) return

    const allowed = checkRateLimit(currentUserId, 'createInvite', RATE_LIMITS.createInvite)
    if (!allowed) {
      setReportFeedback({ type: 'error', text: 'Muitas ações em pouco tempo. Tente novamente.' })
      return
    }

    setInviteLoading(true)
    try {
      const token = generateSecureInviteToken()
      const { error } = await supabase.from('invite_tokens').insert({
        group_id: group.id,
        created_by: currentUserId,
        token,
      })

      if (error) {
        throw error
      }

      const link = buildInviteLink(token)
      setInviteLink(link)
      await navigator.clipboard.writeText(link)
    } catch (error) {
      console.error('group.create-invite-error', error)
    } finally {
      setInviteLoading(false)
    }
  }, [currentUserId, group])

  const handleCopyInviteLink = useCallback(async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
  }, [inviteLink])

  const handleShareInvite = useCallback(async () => {
    if (!inviteLink) return
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: `Convite - ${group?.name || 'SplitMate'}`,
        text: `Entre no grupo ${group?.name || ''}`.trim(),
        url: inviteLink,
      })
      return
    }
    await handleCopyInviteLink()
  }, [group?.name, handleCopyInviteLink, inviteLink])

  const handleCopyInviteFromParticipantsModal = useCallback(async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
      setReportFeedback({ type: 'success', text: 'Link de convite copiado.' })
      return
    }

    await handleCreateInvite()
    setReportFeedback({ type: 'success', text: 'Link de convite gerado e copiado.' })
  }, [handleCreateInvite, inviteLink])

  const whatsappShareUrl = inviteLink
    ? `https://wa.me/?text=${encodeURIComponent(`Entre no meu grupo no SplitMate: ${inviteLink}`)}`
    : ''

  const handleExportCsv = useCallback(() => {
    if (!group || !report) return
    const lines = [
      'participante,total_pago,total_parte,pendente_receber,pendente_pagar,saldo_pendente',
      ...report.participants.map((row) =>
        [
          `"${row.name.replace(/"/g, '""')}"`,
          row.totalPaid.toFixed(2),
          row.totalShare.toFixed(2),
          row.pendingToReceive.toFixed(2),
          row.pendingToPay.toFixed(2),
          row.netPending.toFixed(2),
        ].join(',')
      ),
      '',
      `resumo_total_gasto,${report.totalSpent.toFixed(2)}`,
      `resumo_total_recebido,${report.totalSettled.toFixed(2)}`,
      `resumo_total_pendente,${report.totalPending.toFixed(2)}`,
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `SplitMate-resumo-${group.name.replace(/\s+/g, '-').toLowerCase()}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setReportFeedback({ type: 'success', text: 'CSV exportado com sucesso.' })
  }, [group, report])

  const handleExportPdf = useCallback(() => {
    if (!group || !report) return

    const reportRows = report.participants
      .map(
        (row) => `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;">${row.name}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">R$ ${row.totalPaid.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">R$ ${row.totalShare.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;color:#16a34a;">R$ ${row.pendingToReceive.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;">R$ ${row.pendingToPay.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">R$ ${row.netPending.toFixed(2)}</td>
          </tr>
        `
      )
      .join('')

    const popup = window.open('', '_blank', 'width=900,height=700')
    if (!popup) {
      setReportFeedback({ type: 'error', text: 'Bloqueio de popup ativo. Libere popups para exportar PDF.' })
      return
    }

    popup.document.write(`
      <html>
        <head><title>Resumo financeiro - ${group.name}</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
          <h1 style="margin:0 0 12px 0;">Resumo financeiro - ${group.name}</h1>
          <p style="margin:0 0 16px 0;">Total gasto: R$ ${report.totalSpent.toFixed(2)} | Total recebido: R$ ${report.totalSettled.toFixed(2)} | Pendente: R$ ${report.totalPending.toFixed(2)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Participante</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Total pago</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Sua parte</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">A receber</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">A pagar</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Saldo</th>
              </tr>
            </thead>
            <tbody>${reportRows}</tbody>
          </table>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
    setReportFeedback({ type: 'success', text: 'PDF pronto para salvar via impressão.' })
  }, [group, report])

  const handleRegisterSuggestedSettlements = useCallback(async () => {
    if (!group || suggestedSettlements.length === 0 || !currentUserId) return

    const allowed = checkRateLimit(currentUserId, 'registerPayment', RATE_LIMITS.registerPayment)
    if (!allowed) {
      setReportFeedback({ type: 'error', text: 'Muitas ações em pouco tempo. Tente novamente.' })
      return
    }

    setRegisteringSuggestedSettlements(true)
    setReportFeedback(null)

    let successCount = 0
    let failCount = 0

    for (const settlement of suggestedSettlements) {
      const payload = {
        group_id: group.id,
        from_user: settlement.fromUserId,
        to_user: settlement.toUserId,
        amount: fromCents(settlement.amountCents),
      }

      const { error } = await supabase.from('payments').insert(payload)
      if (error) {
        failCount += 1
        console.error('group.suggested-settlement-insert-error', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          payload,
        })
      } else {
        successCount += 1
      }
    }

    if (successCount > 0 && failCount === 0) {
      setReportFeedback({ type: 'success', text: 'Pagamentos sugeridos registrados com sucesso.' })
    } else if (successCount > 0 && failCount > 0) {
      setReportFeedback({ type: 'error', text: `Foram registrados ${successCount} pagamentos e ${failCount} falharam.` })
    } else {
      setReportFeedback({ type: 'error', text: 'Não foi possível registrar os pagamentos sugeridos.' })
    }

    await loadGroup()
    setRegisteringSuggestedSettlements(false)
  }, [group, suggestedSettlements, loadGroup, currentUserId])

  const handleAddManualParticipant = useCallback(async () => {
    if (!group || !manualParticipantName.trim()) return

    const manualName = manualParticipantName.trim()
    if (!manualName) {
      setReportFeedback({ type: 'error', text: 'Informe o nome do participante.' })
      return
    }

    const normalizedManualName = manualName.toLowerCase()
    const existingManual = group.participantsList.some((participant) => {
      const participantName = String(participant.display_name || participant.name || '').trim().toLowerCase()
      const isManualParticipant = !String(participant.user_id || '').trim()
      return isManualParticipant && participantName === normalizedManualName
    })

    if (existingManual) {
      setReportFeedback({ type: 'error', text: 'Esse participante manual já existe no grupo.' })
      return
    }

    const { error } = await supabase
      .from('participants')
      .insert({
        group_id: group.id,
        user_id: null,
        display_name: manualName,
        role: 'member',
      })

    if (error) {
      console.error('group.manual-participant-insert-error', error)
      if (error.code === '42501') {
        setReportFeedback({ type: 'error', text: 'Sem permissão para adicionar participante (RLS).' })
        return
      }
      if (error.code === '42703' || error.code === '23502') {
        setReportFeedback({
          type: 'error',
          text: 'Participante manual indisponível: aplique as migrations pendentes do Supabase (supabase db push).',
        })
        return
      }
      setReportFeedback({ type: 'error', text: `Erro ao adicionar participante: ${error.message || 'falha desconhecida.'}` })
      return
    }

    setManualParticipantName('')
    setShowParticipantModal(false)
    setReportFeedback({ type: 'success', text: 'Participante adicionado com sucesso.' })
    await loadGroup()
  }, [group, manualParticipantName, loadGroup])

  const handleRemoveParticipant = useCallback(async (participant: Participant) => {
    if (!group || !isOwner) return

    const participantRole = String(participant.role || 'member')
    if (participantRole === 'owner') {
      setReportFeedback({ type: 'error', text: 'O owner do grupo não pode ser removido.' })
      setParticipantsListFeedback({ type: 'error', text: 'O owner do grupo não pode ser removido.' })
      return
    }

    const participantLabel = String(participant.name || participant.display_name || 'Participante')
    const confirmed = window.confirm(`Remover "${participantLabel}" do grupo?`)
    if (!confirmed) return

    setRemovingParticipantId(String(participant.id))
    try {
      let removedCount = 0

      const participantRowId = String(participant.id || '').trim()
      if (participantRowId) {
        const { data, error } = await supabase
          .from('participants')
          .delete()
          .eq('group_id', group.id)
          .eq('id', participantRowId)
          .select('id')

        if (error) throw error
        removedCount += (data ?? []).length
      }

      if (removedCount === 0 && String(participant.user_id || '').trim()) {
        const { data, error } = await supabase
          .from('participants')
          .delete()
          .eq('group_id', group.id)
          .eq('user_id', String(participant.user_id).trim())
          .select('id')

        if (error) throw error
        removedCount += (data ?? []).length
      }

      if (removedCount === 0) {
        const text = 'Não foi possível remover participante. Verifique permissões (RLS) ou recarregue o grupo.'
        setReportFeedback({
          type: 'error',
          text,
        })
        setParticipantsListFeedback({ type: 'error', text })
        return
      }

      setReportFeedback({ type: 'success', text: 'Participante removido com sucesso.' })
      setParticipantsListFeedback({ type: 'success', text: 'Participante removido com sucesso.' })
      await loadGroup()
    } catch (error: any) {
      console.error('group.remove-participant-error', error)
      if (error?.code === '42501') {
        const text = 'Sem permissão para remover participante (RLS).'
        setReportFeedback({ type: 'error', text })
        setParticipantsListFeedback({ type: 'error', text })
      } else if (error?.code === '23503') {
        const text = 'Não é possível remover: participante possui vínculo em dados do grupo.'
        setReportFeedback({ type: 'error', text })
        setParticipantsListFeedback({ type: 'error', text })
      } else {
        const text = error?.message || 'Erro ao remover participante.'
        setReportFeedback({ type: 'error', text })
        setParticipantsListFeedback({ type: 'error', text })
      }
    } finally {
      setRemovingParticipantId(null)
    }
  }, [group, isOwner, loadGroup])

  useEffect(() => {
    const resolveSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setCurrentUserId(null)
        setAuthLoading(false)
        setLoading(false)
        return
      }

      setCurrentUserId(session.user.id)
      setAuthLoading(false)
    }

    isMountedRef.current = true
    resolveSession()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!currentUserId) {
      router.replace('/login')
      return
    }
    loadGroup()
  }, [authLoading, currentUserId, loadGroup, router])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`group-realtime-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `group_id=eq.${groupId}` },
        () => {
          loadGroup()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `group_id=eq.${groupId}` },
        () => {
          loadGroup()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        () => {
          loadGroup()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, groupId, loadGroup])

  const orderedParticipants = useMemo(() => {
    const list = group?.participantsList ?? []
    return [...list].sort((a, b) => {
      const aOwner = String(a.role || 'member') === 'owner' ? 1 : 0
      const bOwner = String(b.role || 'member') === 'owner' ? 1 : 0
      if (aOwner !== bOwner) return bOwner - aOwner

      const aName = String(a.name || a.display_name || '').trim().toLocaleLowerCase('pt-BR')
      const bName = String(b.name || b.display_name || '').trim().toLocaleLowerCase('pt-BR')
      return aName.localeCompare(bName, 'pt-BR')
    })
  }, [group?.participantsList])

  if ((authLoading && !group) || (loading && !group)) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Grupo não encontrado</p>
      </div>
    )
  }

  const amountPerPerson = group.participants > 0 ? group.totalSpent / group.participants : 0
  const topParticipants = orderedParticipants.slice(0, 4)
  const extraParticipants = Math.max(0, orderedParticipants.length - 4)
  const settlementProfiles = orderedParticipants.map((participant) => ({
    userId: String(participant.user_id || participant.id),
    name: participant.name || 'Participante',
    avatarKey: participant.avatar_key,
    isPremium: participant.is_premium,
  }))

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden page-fade">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="tap-target pressable text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">{group.name}</h1>
          {isOwner ? (
            <Link href={`/group/${groupId}/settings`}>
              <button className="tap-target pressable text-gray-600 hover:text-gray-800" type="button">
                <Settings className="w-6 h-6" />
              </button>
            </Link>
          ) : (
            <div className="w-6" />
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowParticipantsListModal(true)}
            className="tap-target touch-friendly pressable flex items-center text-left"
          >
            {topParticipants.map((participant, index) => {
              return (
                <div
                  key={String(participant.user_id || participant.id)}
                  className="w-10 h-10 rounded-full border-2 border-white overflow-hidden"
                  style={{ marginLeft: index > 0 ? '-10px' : '0' }}
                >
                  <UserAvatar
                    name={String(participant.name || participant.display_name || 'Participante')}
                    avatarKey={participant.avatar_key}
                    isPremium={participant.is_premium}
                    className="w-full h-full"
                    textClassName="text-xs"
                  />
                </div>
              )
            })}
            {extraParticipants > 0 && (
              <div
                className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold"
                style={{ marginLeft: '-10px' }}
              >
                +{extraParticipants}
              </div>
            )}
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{orderedParticipants.length} participantes</p>
              <p className="text-xs text-gray-500">Toque para ver a lista</p>
            </div>
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowParticipantModal(true)}
              className="tap-target touch-friendly pressable w-9 h-9 rounded-full bg-[#5BC5A7] text-white active:bg-[#4AB396] flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>
      </div>

      {inviteLink && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3 space-y-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
            />
            <div className="flex items-center gap-2">
              {canNativeShare ? (
                <button
                  type="button"
                  onClick={handleShareInvite}
                  className="tap-target touch-friendly pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100"
                >
                  Compartilhar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="tap-target touch-friendly pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </button>
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="tap-target touch-friendly pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100"
                  >
                    WhatsApp
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showParticipantModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4 max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Adicionar participante</h3>
              <button onClick={() => setShowParticipantModal(false)} type="button" className="tap-target touch-friendly pressable text-gray-500 active:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Participante manual (sem conta)</label>
              <input
                type="text"
                value={manualParticipantName}
                onChange={(e) => setManualParticipantName(e.target.value)}
                placeholder="Nome do participante"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleAddManualParticipant}
                className="w-full tap-target touch-friendly pressable py-2 border border-gray-300 text-gray-700 rounded-lg font-medium active:bg-gray-100"
                type="button"
              >
                Adicionar participante
              </button>
            </div>

            <div className="pt-2 border-t border-gray-200 space-y-2">
              <button
                onClick={async () => {
                  await handleCreateInvite()
                }}
                disabled={inviteLoading}
                className="w-full tap-target touch-friendly pressable py-2 bg-[#5BC5A7] text-white rounded-lg font-medium active:bg-[#4AB396] disabled:opacity-60 flex items-center justify-center gap-2"
                type="button"
              >
                <UserPlus className="w-4 h-4" />
                {inviteLoading ? 'Gerando...' : 'Gerar link de convite'}
              </button>
              {inviteLink && (
                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
                  />
                  <div className="flex items-center gap-2">
                    {canNativeShare ? (
                      <button
                        type="button"
                        onClick={handleShareInvite}
                        className="tap-target touch-friendly pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100"
                      >
                        Compartilhar
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyInviteLink}
                          className="tap-target touch-friendly pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100 flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar link
                        </button>
                        <a
                          href={whatsappShareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="tap-target touch-friendly pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showParticipantsListModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4 max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Participantes do grupo</h3>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleCopyInviteFromParticipantsModal}
                    className="tap-target touch-friendly pressable px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 active:bg-gray-50 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar convite
                  </button>
                )}
                <button onClick={() => setShowParticipantsListModal(false)} type="button" className="tap-target touch-friendly pressable text-gray-500 active:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {participantsListFeedback && (
              <div
                className={`text-sm rounded-lg px-3 py-2 ${
                  participantsListFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}
              >
                {participantsListFeedback.text}
              </div>
            )}

            <div className="space-y-2">
              {orderedParticipants.map((participant) => {
                const isManual = !String(participant.user_id || '').trim()
                return (
                  <div key={String(participant.id)} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={String(participant.name || participant.display_name || 'Participante')}
                        avatarKey={participant.avatar_key}
                        isPremium={participant.is_premium}
                        className="w-9 h-9"
                        textClassName="text-xs"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{String(participant.name || participant.display_name || 'Participante')}</p>
                        <p className="text-xs text-gray-500">{isManual ? 'Manual (sem conta)' : 'Usuário'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          String(participant.role || 'member') === 'owner'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {String(participant.role || 'member') === 'owner' ? 'Owner' : 'Membro'}
                      </span>
                      {isOwner && String(participant.role || 'member') !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(participant)}
                          disabled={removingParticipantId === String(participant.id)}
                          className="tap-target touch-friendly pressable text-red-500 active:text-red-600 disabled:opacity-50"
                          title="Remover participante"
                          aria-label={`Remover ${String(participant.name || participant.display_name || 'participante')}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total gasto</p>
              <p className="text-2xl font-bold text-gray-800">R$ {group.totalSpent.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Seu saldo</p>
              {group.balance === 0 ? (
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl font-bold text-gray-800">{showMyBalance ? 'R$ 0,00' : 'Oculto'}</p>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">zerado</span>
                </div>
              ) : group.balance > 0 ? (
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#5BC5A7]" />
                  <p className="text-2xl font-bold text-[#5BC5A7]">{showMyBalance ? `R$ ${group.balance.toFixed(2)}` : 'Oculto'}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <TrendingDown className="w-5 h-5 text-[#FF6B6B]" />
                  <p className="text-2xl font-bold text-[#FF6B6B]">{showMyBalance ? `R$ ${Math.abs(group.balance).toFixed(2)}` : 'Oculto'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {group.totalSpent > 0 && (
        <div className="bg-[#5BC5A7]/10 border-b border-[#5BC5A7]/20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="text-center">
              <p className="text-sm text-gray-700 mb-1">Cada pessoa fica com:</p>
              <p className="text-2xl font-bold text-[#5BC5A7]">R$ {amountPerPerson.toFixed(2)}</p>
              <p className="text-xs text-gray-600 mt-1">
                Total dividido por {group.participants} {group.participants === 1 ? 'pessoa' : 'pessoas'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="surface-card p-4">
            <button
              type="button"
              onClick={() => setIsReportExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between text-left tap-target pressable"
            >
              <h3 className="section-title">Resumo financeiro</h3>
              {isReportExpanded ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
            </button>

            {isReportExpanded && (
              <div className="mt-4 space-y-4">
                {isPremium && report ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="section-subtitle">Consolidado por participante com saldo pendente do grupo.</p>
                      <div className="flex items-center gap-2">
                        <button onClick={handleExportCsv} type="button" className="tap-target touch-friendly pressable px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 active:bg-gray-100">CSV</button>
                        <button onClick={handleExportPdf} type="button" className="tap-target touch-friendly pressable px-3 py-2 text-sm bg-gray-800 text-white rounded-lg active:bg-gray-700">PDF</button>
                      </div>
                    </div>

                    {reportFeedback && (
                      <div className={`rounded-lg px-3 py-2 text-sm ${reportFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {reportFeedback.text}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3 border border-gray-200"><p className="text-gray-500">Total gasto</p><p className="font-semibold text-gray-800">R$ {report.totalSpent.toFixed(2)}</p></div>
                      <div className="rounded-lg bg-gray-50 p-3 border border-gray-200"><p className="text-gray-500">Total recebido</p><p className="font-semibold text-[#5BC5A7]">R$ {report.totalSettled.toFixed(2)}</p></div>
                      <div className="rounded-lg bg-gray-50 p-3 border border-gray-200"><p className="text-gray-500">Saldo pendente</p><p className="font-semibold text-orange-600">R$ {report.totalPending.toFixed(2)}</p></div>
                    </div>

                    <div className="space-y-2">
                      {report.participants.map((row) => {
                        const scaleBase = Math.max(...report.participants.map((x) => Math.abs(x.netPending)), 1)
                        const widthPercent = Math.max(8, Math.min(100, (Math.abs(row.netPending) / scaleBase) * 100))
                        const isPositive = row.netPending >= 0
                        return (
                          <div key={row.userId} className="rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="font-medium text-gray-800">{row.name}</span>
                              <span className={isPositive ? 'text-[#5BC5A7] font-semibold' : 'text-[#FF6B6B] font-semibold'}>
                                {isPositive ? '+' : '-'} R$ {Math.abs(row.netPending).toFixed(2)}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-2">
                              <div
                                className={`h-2 rounded-full ${isPositive ? 'bg-[#5BC5A7]' : 'bg-[#FF6B6B]'}`}
                                style={{ width: `${widthPercent}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <span>Pago: R$ {row.totalPaid.toFixed(2)}</span>
                              <span>Parte: R$ {row.totalShare.toFixed(2)}</span>
                              <span>A receber: R$ {row.pendingToReceive.toFixed(2)}</span>
                              <span>A pagar: R$ {row.pendingToPay.toFixed(2)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <p className="section-subtitle">Disponível no plano Premium com exportação CSV/PDF e consolidado por participante.</p>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Balanco por pessoa</h4>
                  {personBalances.length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhum gasto pendente entre vocês.</p>
                  ) : (
                    <div className="space-y-2">
                      {personBalances.map((item) => {
                        const isReceive = item.amountCents > 0
                        const debtorId = isReceive ? item.userId : String(currentUserId)
                        const creditorId = isReceive ? String(currentUserId) : item.userId
                        const debtorName = isReceive ? item.name : 'Você'
                        const debtorAvatarKey = isReceive ? item.avatarKey : undefined
                        const debtorIsPremium = isReceive ? item.isPremium : false

                        return (
                          <button
                            key={item.userId}
                            type="button"
                            onClick={() =>
                              setDebtBreakdownTarget({
                                debtorId,
                                creditorId,
                                debtorName,
                                debtorAvatarKey,
                                debtorIsPremium,
                              })
                            }
                            className="w-full text-left rounded-lg border border-gray-200 p-3 bg-gray-50 active:bg-gray-100 tap-target touch-friendly pressable"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <UserAvatar
                                  name={item.name}
                                  avatarKey={item.avatarKey}
                                  isPremium={item.isPremium}
                                  className="w-8 h-8"
                                  textClassName="text-xs"
                                />
                                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                              </div>
                              <p className={`text-sm font-semibold ${isReceive ? 'text-[#5BC5A7]' : 'text-[#FF6B6B]'}`}>
                                {showMyBalance
                                  ? `R$ ${fromCents(Math.abs(item.amountCents)).toFixed(2)} ${isReceive ? 'te deve' : 'Você deve'}`
                                  : 'Oculto'}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Toque para ver o detalhamento da dívida.</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SuggestedSettlements
        suggestions={suggestedSettlements}
        profiles={settlementProfiles}
        onRegister={handleRegisterSuggestedSettlements}
        registering={registeringSuggestedSettlements}
      />

      {!auditReport.valid && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="rounded-lg border border-amber-200 bg-amber-100/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-amber-900">Detectamos inconsistências financeiras neste grupo.</p>
                <button
                  type="button"
                  onClick={() => setShowAuditIssues((prev) => !prev)}
                  className="tap-target touch-friendly pressable px-3 py-1.5 text-xs rounded-lg border border-amber-300 text-amber-900 active:bg-amber-200/60"
                >
                  {showAuditIssues ? 'Ocultar relatório' : 'Ver relatório'}
                </button>
              </div>

              {showAuditIssues && (
                <div className="mt-3 space-y-2">
                  {auditReport.issues.map((issue, index) => (
                    <div key={`${issue.type}-${issue.transactionId || 'no-tx'}-${index}`} className="rounded-md bg-white/80 border border-amber-200 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-900">{issue.type}</p>
                      <p className="text-xs text-amber-800">{issue.message}</p>
                      {issue.transactionId && (
                        <p className="text-[11px] text-amber-700 mt-0.5">Transação: {issue.transactionId}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {debtBreakdownTarget && (
        <DebtBreakdownModal
          open={Boolean(debtBreakdownTarget)}
          onClose={() => setDebtBreakdownTarget(null)}
          debtorId={debtBreakdownTarget.debtorId}
          creditorId={debtBreakdownTarget.creditorId}
          groupId={groupId}
          debtorName={debtBreakdownTarget.debtorName}
          debtorAvatarKey={debtBreakdownTarget.debtorAvatarKey}
          debtorIsPremium={debtBreakdownTarget.debtorIsPremium}
        />
      )}

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {group.transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum gasto ainda</h3>
            <p className="text-gray-600 mb-6">Adicione o primeiro gasto do grupo</p>
            <Link href={`/group/${groupId}/add-expense`}>
              <button className="tap-target touch-friendly pressable bg-[#5BC5A7] text-white px-6 py-3 rounded-lg active:bg-[#4AB396] transition-colors" type="button">
                Adicionar gasto
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Gastos</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{group.transactions.length} {group.transactions.length === 1 ? 'gasto' : 'gastos'}</span>
                <Link href={`/group/${groupId}/add-expense`}>
                  <button
                    type="button"
                    className="tap-target touch-friendly pressable px-3 py-1.5 bg-[#5BC5A7] text-white text-sm rounded-lg active:bg-[#4AB396]"
                  >
                    Adicionar gasto
                  </button>
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {group.transactions.map((transaction) => {
                const transactionParticipants = group.participantsList.filter((p) => transaction.participants.includes(String(p.user_id || p.id)))
                const displayParticipants = transactionParticipants.slice(0, 3)
                const remainingCount = transactionParticipants.length - 3
                const canEditExpense = String(transaction.payerId) === String(currentUserId) && !transaction.isPaid

                const card = (
                  <div className={`surface-card p-4 surface-card-hover ${canEditExpense ? 'cursor-pointer' : ''}`}>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-gray-800 mb-1 truncate">{transaction.description}</h3>
                        <p className="text-sm text-gray-600">{transaction.payerName} pagou</p>
                        <div className="flex items-center gap-1 mt-2">
                          {displayParticipants.map((participant, index) => (
                            <div
                              key={String(participant.user_id || participant.id)}
                              className="w-6 h-6 rounded-full overflow-hidden"
                              style={{ marginLeft: index > 0 ? '-8px' : '0' }}
                            >
                              <UserAvatar
                                name={participant.name}
                                avatarKey={participant.avatar_key}
                                isPremium={participant.is_premium}
                                className="w-full h-full"
                                textClassName="text-[10px]"
                              />
                            </div>
                          ))}
                          {remainingCount > 0 && (
                            <div
                              className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 text-xs font-medium"
                              style={{ marginLeft: '-8px' }}
                            >
                              +{remainingCount}
                            </div>
                          )}
                        </div>
                      </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-semibold text-gray-800">R$ {transaction.amount.toFixed(2)}</p>
                          {transaction.isPaid && (
                            <div className="mt-1 flex items-center justify-end gap-2">
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-[#5BC5A7] border border-green-200">
                                Pago
                              </span>
                              {String(transaction.payerId) === String(currentUserId) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void handleDeletePaidExpense(transaction.id, transaction.payerId, Boolean(transaction.isPaid))
                                  }}
                                  disabled={deletingExpenseId === transaction.id}
                                  className="tap-target touch-friendly pressable inline-flex items-center justify-center w-8 h-8 rounded-full border border-red-200 text-red-500 active:bg-red-50 disabled:opacity-60"
                                  title="Excluir gasto quitado"
                                  aria-label="Excluir gasto quitado"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span>{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                      <span>{transaction.participants.length} {transaction.participants.length === 1 ? 'pessoa' : 'pessoas'}</span>
                    </div>
                    {!canEditExpense && !transaction.isPaid && (
                      <p className="text-xs text-gray-500 mt-2">Somente visualização (apenas quem criou o gasto pode editar)</p>
                    )}
                    {transaction.isPaid && (
                      <p className="text-xs text-[#5BC5A7] mt-2">Gasto quitado (não editável)</p>
                    )}
                  </div>
                )

                if (!canEditExpense) {
                  return <div key={transaction.id}>{card}</div>
                }

                return (
                  <Link key={transaction.id} href={`/group/${groupId}/edit-expense/${transaction.id}`}>
                    {card}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>

      {!isPremium && (
        <div className="max-w-4xl w-full mx-auto px-4 py-4">
          <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
            <p className="text-xs text-gray-500">Espaco reservado para anuncio</p>
          </div>
        </div>
      )}

      <Link href={`/group/${groupId}/add-expense`}>
        <button className="fixed right-6 w-16 h-16 bg-[#5BC5A7] rounded-full flex items-center justify-center shadow-lg active:bg-[#4AB396] transition-all z-40 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" type="button">
          <Plus className="w-8 h-8 text-white" />
        </button>
      </Link>
      <BottomNav />
    </div>
  )
}
