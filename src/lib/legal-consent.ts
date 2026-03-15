'use client'

const LEGAL_CONSENT_PREFIX = 'SplitMate_legal_consent_v1'

export function getLegalConsentKey(userId: string) {
  return `${LEGAL_CONSENT_PREFIX}:${userId}`
}

export function hasLocalLegalConsent(userId: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(getLegalConsentKey(userId)) === '1'
}

export function setLocalLegalConsent(userId: string, accepted: boolean) {
  if (typeof window === 'undefined') return
  const key = getLegalConsentKey(userId)
  if (accepted) {
    window.localStorage.setItem(key, '1')
    return
  }
  window.localStorage.removeItem(key)
}

