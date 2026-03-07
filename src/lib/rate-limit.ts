type RateLimitConfig = {
  maxActions: number
  windowMs: number
}

const actionMap = new Map<string, { count: number; resetAt: number }>()

export const RATE_LIMITS = {
  createGroup: {
    maxActions: 5,
    windowMs: 60000,
  },
  createExpense: {
    maxActions: 30,
    windowMs: 60000,
  },
  createInvite: {
    maxActions: 10,
    windowMs: 60000,
  },
  registerPayment: {
    maxActions: 10,
    windowMs: 60000,
  },
} as const

export function checkRateLimit(
  userId: string,
  action: string,
  config: RateLimitConfig
): boolean {
  const now = Date.now()
  const key = `${String(userId || '').trim()}:${String(action || '').trim()}`
  if (!key || key === ':') return false

  const record = actionMap.get(key)
  if (!record || now >= record.resetAt) {
    actionMap.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return true
  }

  const nextCount = record.count + 1
  actionMap.set(key, {
    ...record,
    count: nextCount,
  })

  if (nextCount > config.maxActions) {
    return false
  }

  return true
}

export type { RateLimitConfig }
