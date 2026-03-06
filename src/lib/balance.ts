import { fromCents, toCents } from '@/lib/money'
import { computePendingEdges } from '@/lib/pending-balances'
import { normalizePersistedSplits } from '@/lib/transaction-splits'

export interface BalanceTransaction {
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

export interface BalancePayment {
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at?: string
}

export interface UserBalanceResult {
  totalSpent: number
  paidByMe: number
  myShare: number
  balance: number
}

function isPaidStatus(status?: string | null) {
  return String(status || '').toLowerCase() === 'paid'
}

export function calculateUserBalance(
  expenses: BalanceTransaction[],
  currentUserId: string,
  payments: BalancePayment[] = []
): UserBalanceResult {
  const totalSpent = Number(
    expenses.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0).toFixed(2)
  )

  let paidByMeCents = 0
  let myShareCents = 0

  const normalizedExpenses = expenses.map((tx) => ({
    ...tx,
    value: Number(tx.value) || 0,
    payer_id: String(tx.payer_id || ''),
    status: String(tx.status || ''),
    description: String(tx.description || ''),
    created_at: tx.created_at || undefined,
    splits: normalizePersistedSplits(Number(tx.value) || 0, tx.splits),
  }))

  for (const tx of normalizedExpenses) {
    if (isPaidStatus(tx.status)) continue

    if (String(tx.payer_id) === String(currentUserId)) {
      paidByMeCents += toCents(tx.value)
    }

    myShareCents += toCents(Number(tx.splits?.[currentUserId] || 0))
  }

  const pendingEdges = computePendingEdges(
    normalizedExpenses.map((tx) => ({
      id: tx.id,
      group_id: tx.group_id,
      payer_id: tx.payer_id,
      value: tx.value,
      description: tx.description || '',
      status: tx.status || '',
      created_at: tx.created_at,
      splits: tx.splits || undefined,
    })),
    payments.map((p) => ({
      group_id: p.group_id,
      from_user: p.from_user,
      to_user: p.to_user,
      amount: Number(p.amount) || 0,
      created_at: p.created_at,
    }))
  )

  let balanceCents = 0
  for (const edge of pendingEdges) {
    const edgeCents = toCents(edge.amount)
    if (String(edge.toUserId) === String(currentUserId)) balanceCents += edgeCents
    if (String(edge.fromUserId) === String(currentUserId)) balanceCents -= edgeCents
  }

  return {
    totalSpent,
    paidByMe: fromCents(paidByMeCents),
    myShare: fromCents(myShareCents),
    balance: fromCents(balanceCents),
  }
}
