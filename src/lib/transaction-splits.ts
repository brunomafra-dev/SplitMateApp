import { fromCents, splitEvenlyInCents, toCents } from '@/lib/money'

export type TransactionSplits = Record<string, number>

function cleanParticipantIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  )
}

export function buildEqualSplits(value: number, participantIds: string[]): TransactionSplits {
  const ids = cleanParticipantIds(participantIds)
  const totalCents = toCents(value)
  const centsByUser = splitEvenlyInCents(totalCents, ids)
  const splits: TransactionSplits = {}

  for (const [userId, cents] of Object.entries(centsByUser)) {
    splits[userId] = fromCents(cents)
  }

  return splits
}

export function buildWeightedSplits(
  value: number,
  participantIds: string[],
  weights: Record<string, number>
): TransactionSplits {
  const ids = cleanParticipantIds(participantIds)
  const totalCents = toCents(value)
  if (ids.length === 0 || totalCents <= 0) return {}

  const normalized = ids.map((id) => ({
    id,
    weight: Math.max(0, Number(weights[id] || 0)),
  }))
  const weightSum = normalized.reduce((acc, item) => acc + item.weight, 0)
  if (weightSum <= 0) return {}

  let allocated = 0
  const rows = normalized.map((item) => {
    const exact = (totalCents * item.weight) / weightSum
    const floorCents = Math.floor(exact)
    allocated += floorCents
    return {
      id: item.id,
      floorCents,
      fraction: exact - floorCents,
    }
  })

  let remainder = totalCents - allocated
  rows
    .slice()
    .sort((a, b) => {
      if (b.fraction !== a.fraction) return b.fraction - a.fraction
      return a.id.localeCompare(b.id)
    })
    .forEach((row) => {
      if (remainder <= 0) return
      row.floorCents += 1
      remainder -= 1
    })

  const splits: TransactionSplits = {}
  for (const row of rows) {
    splits[row.id] = fromCents(row.floorCents)
  }

  return splits
}

export function normalizePersistedSplits(value: number, raw: unknown): TransactionSplits {
  const totalCents = toCents(value)
  if (totalCents <= 0 || !raw || typeof raw !== 'object') return {}

  const entries = Object.entries(raw as Record<string, unknown>)
    .map(([id, split]) => ({
      id: String(id || '').trim(),
      cents: toCents(Number(split) || 0),
    }))
    .filter((entry) => entry.id && entry.cents > 0)

  if (entries.length === 0) return {}

  const unique = new Map<string, number>()
  for (const entry of entries) {
    unique.set(entry.id, entry.cents)
  }

  const rows = Array.from(unique.entries()).map(([id, cents]) => ({ id, cents }))
  const sumCents = rows.reduce((acc, item) => acc + item.cents, 0)
  if (sumCents <= 0) return {}

  if (sumCents === totalCents) {
    const direct: TransactionSplits = {}
    for (const row of rows) {
      direct[row.id] = fromCents(row.cents)
    }
    return direct
  }

  let allocated = 0
  const rescaled = rows.map((row) => {
    const exact = (totalCents * row.cents) / sumCents
    const floorCents = Math.floor(exact)
    allocated += floorCents
    return {
      id: row.id,
      floorCents,
      fraction: exact - floorCents,
    }
  })

  let remainder = totalCents - allocated
  rescaled
    .slice()
    .sort((a, b) => {
      if (b.fraction !== a.fraction) return b.fraction - a.fraction
      return a.id.localeCompare(b.id)
    })
    .forEach((row) => {
      if (remainder <= 0) return
      row.floorCents += 1
      remainder -= 1
    })

  const normalized: TransactionSplits = {}
  for (const row of rescaled) {
    if (row.floorCents > 0) normalized[row.id] = fromCents(row.floorCents)
  }

  return normalized
}
