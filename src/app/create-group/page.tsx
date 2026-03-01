'use client'

import { ArrowLeft, Copy, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureProfileForUser } from '@/lib/profiles'
import { generateSecureInviteToken } from '@/lib/invites'
import { buildInviteLink } from '@/lib/site-url'

type Category = 'apartment' | 'house' | 'trip' | 'other'

interface Participant {
  id: string
  user_id?: string
  display_name?: string
  name: string
  email?: string
}

const categories: Array<{ id: Category; label: string; icon: string }> = [
  { id: 'apartment', label: 'Apartamento', icon: '🏢' },
  { id: 'house', label: 'Casa', icon: '🏠' },
  { id: 'trip', label: 'Viagem', icon: '✈️' },
  { id: 'other', label: 'Outro', icon: '📋' },
]

export default function CreateGroup() {
  const router = useRouter()

  const [groupName, setGroupName] = useState('')
  const [category, setCategory] = useState<Category>('other')
  const [loading, setLoading] = useState(false)
  const [generateInviteOnCreate, setGenerateInviteOnCreate] = useState(true)
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState('')

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          clearTimeout(timer)
          reject(new Error(timeoutMessage))
        }, timeoutMs)
      }),
    ])
  }

  const handleCreateGroup = async () => {
    const trimmedGroupName = groupName.trim()

    if (!trimmedGroupName) {
      alert('Adicione um nome para o grupo')
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        alert('Usuario nao autenticado')
        return
      }

      let profileUsername = ''
      try {
        const profile = await ensureProfileForUser(user)
        profileUsername = profile.username
      } catch {}

      const creatorParticipant: Participant = {
        id: user.id,
        user_id: user.id,
        display_name: 'Voce',
        name: profileUsername || 'Voce',
        email: user.email ?? undefined,
      }

      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: trimmedGroupName,
          category,
          owner_id: user.id,
          participants: [creatorParticipant],
        })
        .select('id')
        .single()

      if (error) {
        alert(error.message || 'Erro ao criar grupo')
        return
      }

      const { error: participantInsertError } = await supabase.from('participants').insert({
        group_id: data.id,
        user_id: user.id,
        role: 'owner',
      })

      if (participantInsertError && participantInsertError.code !== '23505') {
        alert(participantInsertError.message || 'Erro ao criar participante do grupo')
        return
      }

      if (generateInviteOnCreate) {
        const token = generateSecureInviteToken()
        const { error: inviteError } = await withTimeout(
          supabase.from('invite_tokens').insert({
            group_id: data.id,
            created_by: user.id,
            token,
          }),
          10000,
          'create-group.invite-timeout'
        )

        if (!inviteError) {
          setInviteLink(buildInviteLink(token))
          setCreatedGroupId(data.id)
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
      alert('Erro ao criar grupo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Criar grupo</h1>
          <button
            onClick={handleCreateGroup}
            className="text-[#5BC5A7] font-medium hover:text-[#4AB396]"
            disabled={loading}
            type="button"
          >
            Criar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do grupo</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ex: Viagem para Praia"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7]"
          />
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">Categoria</label>
          <div className="grid grid-cols-4 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  category === cat.id ? 'border-[#5BC5A7] bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                type="button"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium text-gray-700">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
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
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
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
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/group/${createdGroupId}`)}
              className="w-full py-3 bg-[#5BC5A7] text-white rounded-xl font-medium"
            >
              Ir para o grupo
            </button>
          </div>
        )}

        <button
          onClick={handleCreateGroup}
          disabled={loading || Boolean(inviteLink)}
          className="w-full py-4 bg-[#5BC5A7] text-white rounded-xl font-medium"
          type="button"
        >
          {loading ? 'Criando...' : 'Criar grupo'}
        </button>
      </main>
    </div>
  )
}
