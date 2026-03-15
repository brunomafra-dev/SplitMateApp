'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

function isLikelyMobileAppWebView() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const inStandalone = window.matchMedia?.('(display-mode: standalone)').matches
  return inStandalone || /Capacitor|wv|Android.*Version\/[\d.]+/i.test(ua)
}

export default function WebAdSense() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
  const [canLoad, setCanLoad] = useState(false)

  useEffect(() => {
    setCanLoad(!isLikelyMobileAppWebView())
  }, [])

  if (!clientId || !canLoad) return null

  return (
    <Script
      id="SplitMate-adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
    />
  )
}

