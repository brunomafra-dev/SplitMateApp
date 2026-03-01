'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { consumePendingProfileSeed, ensureProfileForUser } from '@/lib/profiles'
import { acceptInviteToken, clearPendingInviteToken, peekPendingInviteToken } from '@/lib/invites'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSessionWithTimeout = async (timeoutMs: number) => {
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs)
      })

      try {
        const result = (await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise,
        ])) as { data?: { session?: Session | null } } | null

        return result?.data?.session ?? null
      } catch (error) {
        console.error('auth.get-session-error', error)
        return null
      }
    }

    const ensureIdentity = async (sessionUser: User | null) => {
      if (!sessionUser) return

      const pendingSeed = consumePendingProfileSeed(sessionUser.id)
      try {
        await ensureProfileForUser(sessionUser, {
          username: pendingSeed?.username,
          fullName: pendingSeed?.fullName,
        })
      } catch (error) {
        const code = String((error as { code?: string })?.code || '')
        const message = String((error as { message?: string })?.message || '').toLowerCase()
        const expected =
          code === '42P01' ||
          code === '42501' ||
          message.includes('relation') ||
          message.includes('profiles') ||
          message.includes('permission denied')

        if (!expected) {
          console.error('auth.ensure-profile-error', error)
        }
      }

      const pendingInviteToken = peekPendingInviteToken()
      if (!pendingInviteToken) return

      try {
        const groupId = await acceptInviteToken(pendingInviteToken, sessionUser.id)
        clearPendingInviteToken()
        if (typeof window !== 'undefined' && window.location.pathname !== `/group/${groupId}`) {
          window.location.replace(`/group/${groupId}`)
        }
      } catch {
        // keep token for retry
      }
    }

    const init = async () => {
      const session = await getSessionWithTimeout(5000)
      setSession(session)
      setUser(session?.user ?? null)

      try {
        await ensureIdentity(session?.user ?? null)
      } finally {
        setLoading(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      try {
        await ensureIdentity(session?.user ?? null)
      } finally {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
