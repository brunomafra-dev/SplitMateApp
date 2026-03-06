import { toCents } from '@/lib/money'
import { normalizePersistedSplits } from '@/lib/transaction-splits'

export type DebtBreakdownTransaction = {
  id: string
  description?: string | null
  value: number
  payer_id: string
  splits?: Record<string, number> | null
  status?: string | null
  created_at?: string | null
}

export type DebtBreakdownItem = {
  transactionId: string
  description: string
  amountCents: number
  createdAt: string
}

function isPaid(status?: string | null) {
  return String(status || '').toLowerCase() === 'paid'
}

export function buildDebtBreakdown(
  transactions: DebtBreakdownTransaction[],
  creditorId: string,
  debtorId: string
): DebtBreakdownItem[] {
  const creditor = String(creditorId || '').trim()
  const debtor = String(debtorId || '').trim()
  if (!creditor || !debtor || creditor === debtor) return []

  const results: DebtBreakdownItem[] = []

  for (const tx of transactions) {
    if (isPaid(tx.status)) continue

    const payerId = String(tx.payer_id || '').trim()
    if (payerId !== creditor) continue

    const normalizedSplits = normalizePersistedSplits(Number(tx.value) || 0, tx.splits)
    const rawShare = Number(normalizedSplits[debtor] || 0)
    const amountCents = Math.max(0, toCents(rawShare))
    if (amountCents <= 0) continue

    results.push({
      transactionId: String(tx.id || ''),
      description: String(tx.description || 'Gasto sem descricao'),
      amountCents,
      createdAt: String(tx.created_at || new Date(0).toISOString()),
    })
  }

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return results
}
