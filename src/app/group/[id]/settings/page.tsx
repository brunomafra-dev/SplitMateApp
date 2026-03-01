'use client'

import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'

type Category = 'apartment' | 'house' | 'trip' | 'other'

interface Participant {
  id: string
  name: string
}

const categories: Array<{ id: Category; label: string; icon: string }> = [
  { id: 'apartment', label: 'Apartamento', icon: '🏢' },
  { id: 'house', label: 'Casa', icon: '🏠' },
  { id: 'trip', label: 'Viagem', icon: '✈️' },
  { id: 'other', label: 'Outro', icon: '📋' },
]

export default function GroupSettings() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [isOwner, setIsOwner] = useState(false)

  const [groupName, setGroupName] = useState('')
  const [category, setCategory] = useState<Category>('other')
  const [participants, setParticipants] = useState<Participant[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('groups')
        .select('id,name,category,owner_id')
        .eq('id', groupId)
        .single()

      if (error || !data) {
        console.error('group.settings-load-error', error)
        router.replace(`/group/${groupId}`)
        return
      }

      let { data: meRole } = await supabase
        .from('participants')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!meRole && String(data.owner_id || '') === session.user.id) {
        const { error: ownerInsertError } = await supabase.from('participants').insert({
          group_id: groupId,
          user_id: session.user.id,
          role: 'owner',
        })

        if (ownerInsertError && ownerInsertError.code !== '23505') {
          console.error('group.settings-owner-participant-repair-error', ownerInsertError)
        } else {
          const { data: repairedRole } = await supabase
            .from('participants')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', session.user.id)
            .maybeSingle()

          meRole = repairedRole
        }
      }

      const owner = String(meRole?.role || '') === 'owner'
      setIsOwner(owner)

      setGroupName(data.name || '')
      setCategory((data.category || 'other') as Category)

      const { data: participantRows, error: participantsError } = await supabase
        .from('participants')
        .select('user_id')
        .eq('group_id', groupId)

      if (participantsError) {
        console.error('group.settings-participants-load-error', participantsError)
      }

      const participantIds = ((participantRows as Array<{ user_id?: string }> | null) ?? [])
        .map((row) => String(row.user_id || '').trim())
        .filter(Boolean)

      let profileMap = new Map<string, { username?: string; full_name?: string }>()
      if (participantIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('id,username,full_name')
          .in('id', participantIds)

        if (profilesError) {
          console.error('group.settings-profiles-load-error', profilesError)
        } else {
          for (const row of profileRows ?? []) {
            const id = String((row as { id?: string }).id || '').trim()
            if (!id) continue
            profileMap.set(id, {
              username: String((row as { username?: string }).username || '').trim(),
              full_name: String((row as { full_name?: string }).full_name || '').trim(),
            })
          }
        }
      }

      const loadedParticipants: Participant[] = participantIds.map((id) => {
        const profile = profileMap.get(id)
        return {
          id,
          name: profile?.username || profile?.full_name || 'Usuario',
        }
      })

      setParticipants(loadedParticipants)
      setLoading(false)
    }

    load()
  }, [groupId, router])

  const handleSave = async () => {
    if (!isOwner) {
      alert('Somente o dono pode editar o grupo')
      return
    }

    const trimmedName = groupName.trim()

    if (!trimmedName) {
      alert('Adicione um nome para o grupo')
      return
    }

    setSaving(true)

    const { data, error } = await supabase
      .from('groups')
      .update({
        name: trimmedName,
        category,
      })
      .eq('id', groupId)
      .select('id')

    setSaving(false)

    if (error) {
      console.error('group.settings-save-error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      alert('Erro ao salvar alteracoes')
      return
    }

    if (!data || data.length === 0) {
      console.error('group.settings-save-no-rows', {
        group_id: groupId,
        reason: 'update blocked by RLS or row not found',
      })
      alert('Sem permissao para salvar alteracoes do grupo (RLS)')
      return
    }

    router.replace(`/group/${groupId}`)
    router.refresh()
  }

  const handleDeleteGroup = async () => {
    if (!isOwner) {
      alert('Somente o dono pode excluir o grupo')
      return
    }

    const confirmed = confirm('Tem certeza que deseja excluir este grupo? Esta acao nao pode ser desfeita.')
    if (!confirmed) return

    setDeleting(true)

    const { error: paymentsDeleteError } = await supabase.from('payments').delete().eq('group_id', groupId)
    if (paymentsDeleteError) {
      setDeleting(false)
      console.error('group.settings-delete-payments-error', {
        code: paymentsDeleteError.code,
        message: paymentsDeleteError.message,
        details: paymentsDeleteError.details,
        hint: paymentsDeleteError.hint,
      })
      alert('Erro ao excluir pagamentos do grupo')
      return
    }

    const { error: transactionsDeleteError } = await supabase.from('transactions').delete().eq('group_id', groupId)
    if (transactionsDeleteError) {
      setDeleting(false)
      console.error('group.settings-delete-transactions-error', {
        code: transactionsDeleteError.code,
        message: transactionsDeleteError.message,
        details: transactionsDeleteError.details,
        hint: transactionsDeleteError.hint,
      })
      alert('Erro ao excluir transacoes do grupo')
      return
    }

    const { data, error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)
      .select('id')

    setDeleting(false)

    if (error) {
      console.error('group.settings-delete-error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      alert('Erro ao excluir grupo')
      return
    }

    if (!data || data.length === 0) {
      console.error('group.settings-delete-no-rows', {
        group_id: groupId,
        reason: 'delete blocked by RLS or row not found',
      })
      alert('Sem permissao para excluir este grupo (RLS)')
      return
    }

    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href={`/group/${groupId}`}>
            <button className="text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Editar grupo</h1>
          <button
            onClick={handleSave}
            className="text-[#5BC5A7] font-medium hover:text-[#4AB396]"
            disabled={saving || !isOwner}
            type="button"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do grupo</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ex: Viagem para Praia"
            disabled={!isOwner}
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
                disabled={!isOwner}
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
          <label className="block text-sm font-medium text-gray-700 mb-3">Participantes ({participants.length})</label>

          <div className="space-y-2 mb-4">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">{participant.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isOwner && (
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-red-100">
            <h3 className="text-sm font-medium text-red-600 mb-3">Zona de perigo</h3>
            <button
              onClick={handleDeleteGroup}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-60"
              type="button"
            >
              <Trash2 className="w-4 h-4" />
              <span className="font-medium">{deleting ? 'Excluindo...' : 'Excluir grupo'}</span>
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
