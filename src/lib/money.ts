export function toCents(value: number): number {
  return Math.round((Number(value) || 0) * 100)
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2))
}

export function sanitizeMoney(value: number): number {
  return fromCents(toCents(value))
}

export function splitEvenlyInCents(totalCents: number, participantIds: string[]): Record<string, number> {
  const ids = Array.from(
    new Set(
      participantIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  )

  if (ids.length === 0 || totalCents <= 0) return {}

  const base = Math.floor(totalCents / ids.length)
  const remainder = totalCents % ids.length
  const result: Record<string, number> = {}

  for (let i = 0; i < ids.length; i += 1) {
    result[ids[i]] = base + (i < remainder ? 1 : 0)
  }

  return result
}
