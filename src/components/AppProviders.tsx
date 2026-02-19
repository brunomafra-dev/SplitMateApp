'use client'

import { AuthProvider } from '@/context/AuthContext'
import { AuthGate } from '@/components/AuthGate'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  )
}
