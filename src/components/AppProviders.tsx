'use client'

import { AuthProvider } from '@/context/AuthContext'
import { AuthGate } from '@/components/AuthGate'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { usePremium } from '@/hooks/use-premium'

function PremiumThemeGuard() {
  const { isPremium, premiumResolved } = usePremium()
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    if (!premiumResolved) return
    if (!isPremium && resolvedTheme === 'dark') {
      setTheme('light')
    }
  }, [isPremium, premiumResolved, resolvedTheme, setTheme])

  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const cap = (window as any).Capacitor
    const appPlugin = cap?.Plugins?.App
    if (!appPlugin?.addListener) return

    const handler = (event: { url?: string }) => {
      const rawUrl = String(event?.url || '').trim()
      if (!rawUrl) return

      try {
        const parsed = new URL(rawUrl)
        const inviteMatch = parsed.pathname.match(/^\/invite\/([^/?#]+)/)
        if (inviteMatch?.[1]) {
          window.location.href = `/invite/${inviteMatch[1]}`
          return
        }

        if (parsed.protocol === 'splitmate:' && parsed.hostname === 'invite') {
          const token = parsed.pathname.replace(/^\/+/, '').split('/')[0]
          if (token) {
            window.location.href = `/invite/${token}`
          }
        }
      } catch {
        // ignore malformed incoming deep link
      }
    }

    const listener = appPlugin.addListener('appUrlOpen', handler)
    return () => {
      try {
        if (listener && typeof listener.remove === 'function') {
          listener.remove()
        }
      } catch {
        // ignore cleanup issues
      }
    }
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <PremiumThemeGuard />
        <AuthGate>{children}</AuthGate>
      </AuthProvider>
    </ThemeProvider>
  )
}
