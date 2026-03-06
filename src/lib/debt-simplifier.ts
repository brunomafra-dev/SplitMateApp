import { toCents } from './money'
import type { PendingEdge } from './pending-balances'

export type SimplifiedPayment = {
  fromUserId: string
  toUserId: string
  amountCents: number
}

export type UserBalance = {
  userId: string
  balanceCents: number
}

export function buildBalancesFromEdges(edges: PendingEdge[]): UserBalance[] {
  const balances = new Map<string, number>()

  for (const edge of edges) {
    const amountCents = Math.max(0, toCents(Number(edge.amount) || 0))
    if (amountCents <= 0) continue

    balances.set(edge.fromUserId, (balances.get(edge.fromUserId) || 0) - amountCents)
    balances.set(edge.toUserId, (balances.get(edge.toUserId) || 0) + amountCents)
  }

  return Array.from(balances.entries())
    .map(([userId, balanceCents]) => ({ userId, balanceCents }))
    .filter((row) => row.balanceCents !== 0)
}

export function simplifyDebts(
  balances: UserBalance[]
): SimplifiedPayment[] {
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ ...b }))
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ ...b }))

  debtors.sort((a, b) => a.balanceCents - b.balanceCents)
  creditors.sort((a, b) => b.balanceCents - a.balanceCents)

  const results: SimplifiedPayment[] = []

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0]
    const creditor = creditors[0]

    const amount = Math.min(
      Math.abs(debtor.balanceCents),
      creditor.balanceCents
    )

    if (amount > 0 && debtor.userId !== creditor.userId) {
      results.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountCents: amount,
      })
    }

    debtor.balanceCents += amount
    creditor.balanceCents -= amount

    if (debtor.balanceCents === 0) debtors.shift()
    if (creditor.balanceCents === 0) creditors.shift()
  }

  return results.filter((payment) => payment.amountCents > 0 && payment.fromUserId !== payment.toUserId)
}
