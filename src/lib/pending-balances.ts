export interface PendingTransactionLike {
  id: string
  group_id: string
  payer_id: string
  value: number
  description?: string
  status?: string
  created_at?: string
  participants?: string[]
  splits?: Record<string, number>
}

export interface PendingPaymentLike {
  group_id: string
  from_user: string
  to_user: string
  amount: number
  created_at?: string
}

export interface PendingEdge {
  txId: string
  groupId: string
  fromUserId: string
  toUserId: string
  amount: number
  date: string
  description: string
}

function toMs(value?: string) {
  const t = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(t) ? t : 0
}

function toCents(value: number) {
  return Math.round((Number(value) || 0) * 100)
}

function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2))
}

export function computePendingEdges(
  transactions: PendingTransactionLike[],
  payments: PendingPaymentLike[],
  membersByGroup: Map<string, string[]>
) {
  const rawDebts: Array<PendingEdge & { remainingCents: number; amountCents: number; ms: number }> = []

  for (const tx of transactions) {
    if (String(tx.status || '').toLowerCase() === 'paid') continue

    const txValueCents = toCents(Number(tx.value) || 0)
    if (txValueCents <= 0) continue

    const fallbackParticipants = membersByGroup.get(tx.group_id) || []
    const explicitParticipants = Array.isArray(tx.participants)
      ? tx.participants.map((id) => String(id || '').trim()).filter(Boolean)
      : []

    const participants = explicitParticipants.length > 0 ? explicitParticipants : fallbackParticipants
    if (participants.length === 0) continue

    const payerId = String(tx.payer_id || '').trim()
    if (!payerId) continue

    const splits = tx.splits && typeof tx.splits === 'object' ? tx.splits : null
    const hasExplicitSplits = !!splits && Object.keys(splits).length > 0

    const shareCentsByParticipant = new Map<string, number>()
    if (hasExplicitSplits) {
      for (const participantId of participants) {
        const cents = toCents(Number((splits as Record<string, number>)[participantId] || 0))
        shareCentsByParticipant.set(participantId, Math.max(0, cents))
      }
    } else {
      const base = Math.floor(txValueCents / participants.length)
      const remainder = txValueCents % participants.length
      for (let i = 0; i < participants.length; i += 1) {
        const participantId = participants[i]
        const cents = base + (i < remainder ? 1 : 0)
        shareCentsByParticipant.set(participantId, cents)
      }
    }

    const dateIso = tx.created_at || new Date().toISOString()
    const ms = toMs(dateIso)

    for (const participantId of participants) {
      if (participantId === payerId) continue

      const debtAmountCents = Math.max(0, shareCentsByParticipant.get(participantId) || 0)
      if (debtAmountCents <= 0) continue

      rawDebts.push({
        txId: tx.id,
        groupId: tx.group_id,
        fromUserId: participantId,
        toUserId: payerId,
        amount: fromCents(debtAmountCents),
        amountCents: debtAmountCents,
        remainingCents: debtAmountCents,
        date: dateIso,
        description: tx.description || 'Acerto de gasto',
        ms,
      })
    }
  }

  const debtsByPair = new Map<string, Array<PendingEdge & { remaining: number; ms: number }>>()
  for (const debt of rawDebts) {
    const key = `${debt.groupId}|${debt.fromUserId}|${debt.toUserId}`
    const list = debtsByPair.get(key) || []
    list.push(debt)
    debtsByPair.set(key, list)
  }
  for (const list of debtsByPair.values()) {
    list.sort((a, b) => a.ms - b.ms)
  }

  const paymentsSorted = [...payments]
    .map((p) => ({ ...p, amountCents: toCents(Number(p.amount) || 0), ms: toMs(p.created_at) }))
    .filter((p) => p.amountCents > 0)
    .sort((a, b) => a.ms - b.ms)

  for (const payment of paymentsSorted) {
    const key = `${payment.group_id}|${payment.from_user}|${payment.to_user}`
    const debts = debtsByPair.get(key)
    if (!debts || debts.length === 0) continue

    let remainingPaymentCents = payment.amountCents
    for (const debt of debts) {
      if (remainingPaymentCents <= 0) break
      if (debt.remainingCents <= 0) continue
      if (payment.ms > 0 && debt.ms > payment.ms) continue
      const abatCents = Math.min(debt.remainingCents, remainingPaymentCents)
      debt.remainingCents -= abatCents
      remainingPaymentCents -= abatCents
    }
  }

  return rawDebts
    .filter((debt) => debt.remainingCents > 0)
    .map((debt) => ({
      txId: debt.txId,
      groupId: debt.groupId,
      fromUserId: debt.fromUserId,
      toUserId: debt.toUserId,
      amount: fromCents(debt.remainingCents),
      date: debt.date,
      description: debt.description,
    }))
}
