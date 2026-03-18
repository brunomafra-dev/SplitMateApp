export function getAuthRedirectUrl(pathname: string = '/auth/callback'): string {
  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${getCanonicalSiteUrl()}${safePath}`
}

export function getCanonicalSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    const normalized = siteUrl.replace(/\/$/, '')
    if (normalized.includes('divideai-eta.vercel.app')) {
      return 'https://splitmateapp.vercel.app'
    }
    return normalized
  }

  return 'https://splitmateapp.vercel.app'
}

export function getRuntimeOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '')
  }

  return getCanonicalSiteUrl()
}

export function getAppBaseUrl(): string {
  return getRuntimeOrigin()
}

export function buildInviteLink(token: string): string {
  const safeToken = String(token || '').trim()
  return `${getCanonicalSiteUrl()}/invite/${safeToken}`
}
