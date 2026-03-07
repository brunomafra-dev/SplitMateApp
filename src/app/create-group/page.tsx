'use client'

import { ArrowLeft, Copy, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureProfileForUser } from '@/lib/profiles'
import { generateSecureInviteToken } from '@/lib/invites'
import { buildInviteLink } from '@/lib/site-url'
import BottomNav from '@/components/ui/bottom-nav'
import { fetchGroupQuota, type GroupQuota } from '@/lib/group-quota'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

type Category = 'apartment' | 'house' | 'trip' | 'other'

const categories: Array<{ id: Category; label: string; icon: string }> = [
  { id: 'apartment', label: 'Apartamento', icon: '\u{1F3E2}' },
  { id: 'house', label: 'Casa', icon: '\u{1F3E0}' },
  { id: 'trip', label: 'Viagem', icon: '\u{2708}\u{FE0F}' },
  { id: 'other', label: 'Outro', icon: '\u{1F4CB}' },
]

export default function CreateGroup() {
  const router = useRouter()

  const [groupName, setGroupName] = useState('')
  const [category, setCategory] = useState<Category>('other')
  const [loading, setLoading] = useState(false)
  const [generateInviteOnCreate, setGenerateInviteOnCreate] = useState(true)
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [quota, setQuota] = useState<GroupQuota | null>(null)

  const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          clearTimeout(timer)
          reject(new Error(timeoutMessage))
        }, timeoutMs)
      }),
    ])
  }

  useEffect(() => {
    const loadQuota = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const currentQuota = await fetchGroupQuota(user.id)
      setQuota(currentQuota)
    }
    loadQuota()
  }, [])

  const handleCreateGroup = async () => {
    const trimmedGroupName = groupName.trim()

    if (!trimmedGroupName) {
      setFeedback({ type: 'error', text: 'Adicione um nome para o grupo.' })
      return
    }

    setLoading(true)
    setFeedback(null)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setFeedback({ type: 'error', text: 'Usuario nao autenticado.' })
        return
      }

      const currentQuota = await fetchGroupQuota(user.id)
      setQuota(currentQuota)
      if (!currentQuota.canCreateGroup) {
        setFeedback({
          type: 'error',
          text: `Plano Free permite ate ${currentQuota.freeLimit} grupos. Faca upgrade para Premium para criar grupos ilimitados.`,
        })
        return
      }

      const allowed = checkRateLimit(user.id, 'createGroup', RATE_LIMITS.createGroup)
      if (!allowed) {
        setFeedback({ type: 'error', text: 'Muitas ações em pouco tempo. Tente novamente.' })
        return
      }

      try {
        await ensureProfileForUser(user)
      } catch {}

      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: trimmedGroupName,
          category,
          owner_id: user.id,
        })
        .select('id')
        .single()

      if (error) {
        const errorMessage = String(error.message || '').toLowerCase()
        if (errorMessage.includes('free_group_limit_reached') || errorMessage.includes('plano free')) {
          setFeedback({
            type: 'error',
            text: 'Limite do plano Free atingido (3 grupos). Faca upgrade para Premium para criar grupos ilimitados.',
          })
        } else {
          setFeedback({ type: 'error', text: error.message || 'Erro ao criar grupo.' })
        }
        return
      }

      const { error: participantInsertError } = await supabase.from('participants').insert({
        group_id: data.id,
        user_id: user.id,
        role: 'owner',
      })

      if (participantInsertError && participantInsertError.code !== '23505') {
        setFeedback({ type: 'error', text: participantInsertError.message || 'Erro ao criar participante do grupo.' })
        return
      }

      if (generateInviteOnCreate) {
        const token = generateSecureInviteToken()
        const inviteInsertResult = await withTimeout(
          supabase.from('invite_tokens').insert({
            group_id: data.id,
            created_by: user.id,
            token,
          }),
          10000,
          'create-group.invite-timeout'
        )
        const inviteError = (inviteInsertResult as { error?: { code?: string; message?: string; details?: string | null; hint?: string | null } | null })?.error || null

        if (!inviteError) {
          setInviteLink(buildInviteLink(token))
          setCreatedGroupId(data.id)
          setFeedback({ type: 'success', text: 'Grupo criado com sucesso. Link de convite gerado.' })
          return
        }

        console.error('create-group.invite-insert-error', {
          code: inviteError.code,
          message: inviteError.message,
          details: inviteError.details,
          hint: inviteError.hint,
        })
      }

      router.push(`/group/${data.id}`)
    } catch (error: any) {
      console.error('create-group.unhandled-error', {
        message: String(error?.message || ''),
        raw: error,
      })
      setFeedback({ type: 'error', text: 'Erro ao criar grupo. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden page-fade">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="tap-target pressable text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">Criar grupo</h1>
          <button
            onClick={handleCreateGroup}
            className="tap-target pressable text-[#5BC5A7] font-medium hover:text-[#4AB396]"
            disabled={loading || Boolean(quota && !quota.canCreateGroup)}
            type="button"
          >
            Criar
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-6">
        {feedback && (
          <div className={`rounded-lg px-3 py-2 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {feedback.text}
          </div>
        )}

        {quota && !quota.isPremium && (
          <div className="rounded-lg px-3 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200">
            Plano Free: {quota.ownedGroups}/{quota.freeLimit} grupos criados.
          </div>
        )}

        <div className="surface-card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do grupo</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ex: Viagem para Praia"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7]"
          />
        </div>

        <div className="surface-card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Categoria</label>
          <div className="grid grid-cols-4 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`tap-target pressable flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all focus:outline-none ${
                  category === cat.id
                    ? 'border-[#5BC5A7] bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-400/70'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
                }`}
                type="button"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-card p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={generateInviteOnCreate}
              onChange={(e) => setGenerateInviteOnCreate(e.target.checked)}
              className="w-4 h-4 text-[#5BC5A7] border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Gerar link de convite ao criar grupo
            </span>
          </label>
        </div>

        {inviteLink && createdGroupId && (
          <div className="surface-card p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Link de convite gerado</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
              />
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink)
                }}
                className="tap-target pressable px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/group/${createdGroupId}`)}
              className="w-full tap-target pressable py-3 bg-[#5BC5A7] text-white rounded-xl font-medium"
            >
              Ir para o grupo
            </button>
          </div>
        )}

        <button
          onClick={handleCreateGroup}
          disabled={loading || Boolean(inviteLink) || Boolean(quota && !quota.canCreateGroup)}
          className="w-full tap-target pressable py-4 bg-[#5BC5A7] text-white rounded-xl font-medium disabled:opacity-60"
          type="button"
        >
          {loading ? 'Criando...' : 'Criar grupo'}
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
