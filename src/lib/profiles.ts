import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getDefaultAvatarKey } from '@/lib/avatar-presets'

export interface ProfileRow {
  id: string
  username: string
  full_name: string
  is_premium: boolean
  avatar_key?: string
  created_at?: string
}

type ParticipantLike = {
  id?: string
  user_id?: string
  name?: string
  display_name?: string
  email?: string
}

type ProfileSeed = {
  userId: string
  username: string
  fullName: string
}

const PENDING_PROFILE_KEY = 'SplitMate_pending_profile_seed'

function normalizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function fallbackFullName(user: User) {
  const metadata = (user.user_metadata || {}) as { full_name?: string }
  const fromMetadata = String(metadata.full_name || '').trim()
  if (fromMetadata) return fromMetadata
  return user.email?.split('@')[0] || 'Usuario'
}

function fallbackUsername(user: User) {
  const metadata = (user.user_metadata || {}) as { username?: string }
  const fromMetadata = normalizeUsername(String(metadata.username || ''))
  if (fromMetadata) return fromMetadata
  const fromEmail = normalizeUsername(user.email?.split('@')[0] || '')
  if (fromEmail) return fromEmail
  return `user_${String(user.id).replace(/-/g, '').slice(0, 8)}`
}

function isDuplicateError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return code === '23505' || message.includes('duplicate')
}

function isMissingProfileError(error: unknown) {
  const code = (error as { code?: string })?.code
  return code === 'PGRST116'
}

export function savePendingProfileSeed(seed: ProfileSeed) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(seed))
}

export function consumePendingProfileSeed(userId: string): ProfileSeed | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PENDING_PROFILE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as ProfileSeed
    if (String(parsed.userId) !== String(userId)) return null
    window.localStorage.removeItem(PENDING_PROFILE_KEY)
    return parsed
  } catch {
    window.localStorage.removeItem(PENDING_PROFILE_KEY)
    return null
  }
}

export async function ensureProfileForUser(
  user: User,
  seed?: { username?: string; fullName?: string }
) {
  let current = await supabase
    .from('profiles')
    .select('id,username,full_name,is_premium,avatar_key,created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (current.error) {
    const fallback = await supabase
      .from('profiles')
      .select('id,username,full_name,is_premium,created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (!fallback.error) {
      current = fallback as typeof current
    }
  }

  if (current.data) return current.data as ProfileRow

  if (current.error && !isMissingProfileError(current.error)) {
    throw current.error
  }

  const baseUsername = normalizeUsername(seed?.username || '') || fallbackUsername(user)
  const fullName = (seed?.fullName || '').trim() || fallbackFullName(user)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}_${attempt + 1}`

    let insert = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username,
        full_name: fullName,
        is_premium: false,
        avatar_key: getDefaultAvatarKey(user.id),
      })
      .select('id,username,full_name,is_premium,avatar_key,created_at')
      .single()

    if (insert.error) {
      const insertFallback = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username,
          full_name: fullName,
          is_premium: false,
        })
        .select('id,username,full_name,is_premium,created_at')
        .single()

      if (!insertFallback.error) {
        insert = insertFallback as typeof insert
      }
    }

    if (!insert.error) {
      return insert.data as ProfileRow
    }

    if (isDuplicateError(insert.error)) continue
    throw insert.error
  }

  throw new Error('username_already_taken')
}

export async function hydrateParticipantsWithProfiles<T extends ParticipantLike>(participants: T[]): Promise<T[]> {
  if (!Array.isArray(participants) || participants.length === 0) return participants

  const userIds = Array.from(
    new Set(
      participants
        .map((p) => String(p?.user_id || '').trim())
        .filter(Boolean)
    )
  )

  if (userIds.length === 0) return participants

  const { data, error } = await supabase
    .from('profiles')
    .select('id,username')
    .in('id', userIds)

  if (error) return participants

  const usernameMap = new Map<string, string>()
  for (const row of data || []) {
    const id = String((row as { id?: string }).id || '')
    const username = String((row as { username?: string }).username || '')
    if (id && username) usernameMap.set(id, username)
  }

  return participants.map((p) => {
    const userId = String(p.user_id || '').trim()
    if (!userId) return p

    const username = usernameMap.get(userId)
    if (!username) return p

    return {
      ...p,
      name: username,
      display_name: p.display_name || p.name || p.email || username,
    }
  })
}
