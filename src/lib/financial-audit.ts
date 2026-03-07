import { toCents } from '@/lib/money'
import { computePendingEdges } from '@/lib/pending-balances'

export type FinancialAuditIssue = {
  type: string
  message: string
  transactionId?: string
}

export type FinancialAuditReport = {
  valid: boolean
  issues: FinancialAuditIssue[]
}

type AuditTransaction = {
  id: string
  group_id: string
  value: number
  payer_id: string
  participants?: string[] | null
  splits?: Record<string, number> | null
  status?: string | null
  description?: string | null
  created_at?: string | null
}

type AuditParticipant = string | { id?: string; user_id?: string }

type AuditPayment = {
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at?: string | null
}

function toParticipantId(participant: AuditParticipant) {
  if (typeof participant === 'string') return String(participant || '').trim()
  return String(participant.user_id || participant.id || '').trim()
}

function pairKey(groupId: string, fromUserId: string, toUserId: string) {
  return `${String(groupId || '').trim()}|${String(fromUserId || '').trim()}|${String(toUserId || '').trim()}`
}

export function auditGroupFinancialIntegrity(
  transactions: AuditTransaction[],
  participants: AuditParticipant[],
  payments: AuditPayment[]
): FinancialAuditReport {
  const issues: FinancialAuditIssue[] = []

  const participantIds = new Set(
    ((participants as AuditParticipant[] | null) ?? [])
      .map(toParticipantId)
      .filter(Boolean)
  )

  const safeTransactions: AuditTransaction[] = ((transactions as AuditTransaction[] | null) ?? []).map((tx) => ({
    id: String(tx.id || ''),
    group_id: String(tx.group_id || ''),
    value: Number(tx.value) || 0,
    payer_id: String(tx.payer_id || '').trim(),
    participants: Array.isArray(tx.participants)
      ? tx.participants.map((id) => String(id || '').trim()).filter(Boolean)
      : undefined,
    splits: tx.splits && typeof tx.splits === 'object' ? tx.splits : undefined,
    status: String(tx.status || ''),
    description: String(tx.description || ''),
    created_at: String(tx.created_at || ''),
  }))

  const safePayments: AuditPayment[] = ((payments as AuditPayment[] | null) ?? []).map((payment) => ({
    group_id: String(payment.group_id || ''),
    from_user: String(payment.from_user || '').trim(),
    to_user: String(payment.to_user || '').trim(),
    amount: Number(payment.amount) || 0,
    created_at: String(payment.created_at || ''),
  }))

  for (const tx of safeTransactions) {
    const transactionId = String(tx.id || '')
    const valueCents = toCents(Number(tx.value) || 0)
    const payerId = String(tx.payer_id || '').trim()
    const splits = tx.splits && typeof tx.splits === 'object' ? tx.splits : null
    const splitEntries = splits ? Object.entries(splits) : []

    if (!splits || splitEntries.length === 0) {
      issues.push({
        type: 'MISSING_SPLITS',
        message: 'Transacao nao possui divisao registrada',
        transactionId,
      })
    }

    // Legacy rows may have empty `participants` snapshot but valid `splits`.
    // Flag only when both participants and splits are effectively empty.
    if (Array.isArray(tx.participants) && tx.participants.length === 0 && splitEntries.length === 0) {
      issues.push({
        type: 'EMPTY_PARTICIPANTS',
        message: 'Transacao nao possui participantes',
        transactionId,
      })
    }

    if (!participantIds.has(payerId)) {
      issues.push({
        type: 'INVALID_PAYER',
        message: 'Pagador da transacao nao pertence ao grupo',
        transactionId,
      })
    }

    if (splitEntries.length > 0) {
      let sumSplitCents = 0
      let payerInSplits = false

      for (const [userIdRaw, splitValueRaw] of splitEntries) {
        const userId = String(userIdRaw || '').trim()
        const splitCents = toCents(Number(splitValueRaw) || 0)

        if (splitCents <= 0) {
          issues.push({
            type: 'INVALID_SPLIT_VALUE',
            message: 'Split possui valor invalido',
            transactionId,
          })
        }

        if (!participantIds.has(userId)) {
          issues.push({
            type: 'INVALID_PARTICIPANT_IN_SPLIT',
            message: 'Split contem participante que nao pertence ao grupo',
            transactionId,
          })
        }

        if (userId === payerId) payerInSplits = true
        sumSplitCents += splitCents
      }

      if (sumSplitCents !== valueCents) {
        issues.push({
          type: 'SPLIT_SUM_INVALID',
          message: 'Soma dos splits nao corresponde ao valor da transacao',
          transactionId,
        })
      }

      if (!payerInSplits) {
        issues.push({
          type: 'PAYER_NOT_IN_SPLITS',
          message: 'Pagador nao esta presente na divisao',
          transactionId,
        })
      }
    }
  }

  const originalDebtEdges = computePendingEdges(
    safeTransactions.map((tx) => ({
      id: tx.id,
      group_id: tx.group_id,
      payer_id: tx.payer_id,
      value: tx.value,
      description: tx.description || '',
      status: '',
      created_at: tx.created_at || undefined,
      participants: Array.isArray(tx.participants) ? tx.participants : undefined,
      splits: tx.splits || undefined,
    })),
    []
  )

  const debtByPair = new Map<string, number>()
  for (const edge of originalDebtEdges) {
    const key = pairKey(edge.groupId, edge.fromUserId, edge.toUserId)
    const amountCents = toCents(edge.amount)
    if (amountCents <= 0) continue
    debtByPair.set(key, (debtByPair.get(key) || 0) + amountCents)
  }

  const paymentsByPair = new Map<string, number>()
  for (const payment of safePayments) {
    const amountCents = toCents(payment.amount)
    if (amountCents <= 0) continue
    const key = pairKey(payment.group_id, payment.from_user, payment.to_user)
    paymentsByPair.set(key, (paymentsByPair.get(key) || 0) + amountCents)
  }

  for (const [key, paidCents] of paymentsByPair.entries()) {
    const debtCents = debtByPair.get(key) || 0
    if (paidCents > debtCents) {
      const [groupId, fromUserId, toUserId] = key.split('|')
      issues.push({
        type: 'OVERPAYMENT',
        message: `Pagamento maior que a divida registrada (${fromUserId} -> ${toUserId} no grupo ${groupId})`,
      })
    }
  }

  if (issues.length === 0) {
    return {
      valid: true,
      issues: [],
    }
  }

  return {
    valid: false,
    issues,
  }
}
