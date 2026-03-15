'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const DEV_PREMIUM_KEY = 'SplitMate_dev_premium'
const DB_PREMIUM_KEY = 'SplitMate_is_premium'
const PREMIUM_SYNC_EVENT = 'SplitMate:premium-sync'
type DevPremiumOverride = 'true' | 'false' | null

export function usePremium() {
  const { user, loading: authLoading } = useAuth()
  const [resolved, setResolved] = useState(false)
  const [dbPremium, setDbPremium] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(DB_PREMIUM_KEY) === '1'
  })
  const [devPremiumOverride, setDevPremiumOverride] = useState<DevPremiumOverride>(() => {
    if (typeof window === 'undefined') return null
    const value = window.localStorage.getItem(DEV_PREMIUM_KEY)
    if (value === 'true' || value === 'false') return value
    return null
  })
  const isDev = process.env.NODE_ENV !== 'production'

  const syncFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return
    setDbPremium(window.localStorage.getItem(DB_PREMIUM_KEY) === '1')
    const override = window.localStorage.getItem(DEV_PREMIUM_KEY)
    setDevPremiumOverride(override === 'true' || override === 'false' ? override : null)
  }, [])

  const broadcastPremiumSync = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event(PREMIUM_SYNC_EVENT))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEV_PREMIUM_KEY || event.key === DB_PREMIUM_KEY) {
        syncFromStorage()
      }
    }
    const onPremiumSync = () => {
      syncFromStorage()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(PREMIUM_SYNC_EVENT, onPremiumSync)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(PREMIUM_SYNC_EVENT, onPremiumSync)
    }
  }, [syncFromStorage])

  useEffect(() => {
    let mounted = true
    let activeChannel: ReturnType<typeof supabase.channel> | null = null

    const loadPremium = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted) return
      const nextValue = Boolean(data?.is_premium)
      setDbPremium(nextValue)
      window.localStorage.setItem(DB_PREMIUM_KEY, nextValue ? '1' : '0')
      broadcastPremiumSync()
      setResolved(true)
    }

    if (authLoading) {
      return () => {
        mounted = false
      }
    }

    if (!user?.id) {
      setDbPremium(false)
      window.localStorage.setItem(DB_PREMIUM_KEY, '0')
      broadcastPremiumSync()
      setResolved(true)
      return () => {
        mounted = false
      }
    }

    setResolved(false)
    void loadPremium(user.id)

    activeChannel = supabase
      .channel(`premium-profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          void loadPremium(user.id)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [authLoading, broadcastPremiumSync, user?.id])

  const setPremium = useCallback(async (nextValue: boolean) => {
    if (!user?.id) return false

    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: nextValue })
      .eq('id', user.id)

    if (error) return false

    setDbPremium(nextValue)
    window.localStorage.setItem(DB_PREMIUM_KEY, nextValue ? '1' : '0')
    broadcastPremiumSync()
    return true
  }, [broadcastPremiumSync, user?.id])

  const setDevPremium = useCallback((nextValue: boolean | null) => {
    if (!isDev) return
    const normalized: DevPremiumOverride =
      nextValue === null ? null : nextValue ? 'true' : 'false'
    setDevPremiumOverride(normalized)
    if (normalized === null) {
      window.localStorage.removeItem(DEV_PREMIUM_KEY)
      broadcastPremiumSync()
      return
    }
    window.localStorage.setItem(DEV_PREMIUM_KEY, normalized)
    broadcastPremiumSync()
  }, [broadcastPremiumSync, isDev])

  const devPremium = devPremiumOverride === 'true'
  const isPremium = isDev && devPremiumOverride !== null
    ? devPremiumOverride === 'true'
    : dbPremium

  return {
    isPremium,
    premiumResolved: resolved,
    setPremium,
    isDev,
    devPremium,
    devPremiumOverride,
    setDevPremium,
  }
}
