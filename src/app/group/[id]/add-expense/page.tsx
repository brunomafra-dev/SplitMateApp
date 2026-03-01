'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'

interface Participant {
  id: string
  name: string
}

interface Group {
  id: string
  name: string
  participantsList: Participant[]
}

export default function AddExpense() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [group, setGroup] = useState<Group | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payerId, setPayerId] = useState('')
  const [splitType, setSplitType] = useState<'equal' | 'manual'>('equal')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
        .select('id,name')
        .eq('id', groupId)
        .single()

      if (error || !data) {
        console.error('add-expense.group-load-error', error)
        router.replace(`/group/${groupId}`)
        return
      }

      const { data: participantRows, error: participantsError } = await supabase
        .from('participants')
        .select('user_id')
        .eq('group_id', groupId)

      if (participantsError) {
        console.error('add-expense.participants-load-error', participantsError)
        router.replace(`/group/${groupId}`)
        return
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
          console.error('add-expense.profiles-load-error', profilesError)
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

      const participantsList: Participant[] = participantIds.map((id) => {
        const profile = profileMap.get(id)
        return {
          id,
          name: profile?.username || profile?.full_name || 'Usuario',
        }
      })

      setGroup({
        id: data.id,
        name: data.name,
        participantsList,
      })

      setPayerId(
        participantsList.some((p) => p.id === session.user.id)
          ? session.user.id
          : (participantsList[0]?.id || session.user.id)
      )
      setSelectedParticipants(participantsList.map((p) => p.id))
      setLoading(false)
    }

    load()
  }, [groupId, router])

  const toggleParticipant = (participantId: string) => {
    if (selectedParticipants.includes(participantId)) {
      setSelectedParticipants(selectedParticipants.filter((id) => id !== participantId))
    } else {
      setSelectedParticipants([...selectedParticipants, participantId])
    }
  }

  const handleSave = async () => {
    if (!amount || !description || !payerId || selectedParticipants.length === 0) {
      alert('Preencha todos os campos')
      return
    }

    const amountValue = parseFloat(amount)
    if (isNaN(amountValue) || amountValue <= 0) {
      alert('Valor invalido')
      return
    }

    if (!group) return

    setSaving(true)

    const participantsForSplit = selectedParticipants.length > 0 ? selectedParticipants : [payerId]
    const splitAmount = Number((amountValue / participantsForSplit.length).toFixed(2))

    const splits: Record<string, number> = {}
    for (const pid of participantsForSplit) {
      splits[pid] = splitAmount
    }

    const basePayload = {
      group_id: groupId,
      value: amountValue,
      description: description.trim(),
      payer_id: payerId,
    }

    let { error } = await supabase.from('transactions').insert({
      ...basePayload,
      participants: participantsForSplit,
      splits,
    })

    if (error?.code === 'PGRST204' && error.message?.includes("'participants'")) {
      const retry = await supabase.from('transactions').insert({
        ...basePayload,
        splits,
      })
      error = retry.error
    }

    if (error?.code === 'PGRST204' && error.message?.includes("'splits'")) {
      const retry = await supabase.from('transactions').insert(basePayload)
      error = retry.error
    }

    setSaving(false)

    if (error) {
      console.error('add-expense.insert-error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        raw: JSON.stringify(error),
        payload: {
          group_id: groupId,
          payer_id: payerId,
          participants: participantsForSplit,
          value: amountValue,
        },
      })
      alert('Erro ao salvar gasto')
      return
    }

    router.replace(`/group/${groupId}`)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Grupo nao encontrado</p>
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
          <h1 className="text-lg font-semibold text-gray-800">Adicionar gasto</h1>
          <button
            onClick={handleSave}
            className="text-[#5BC5A7] font-medium hover:text-[#4AB396]"
            type="button"
            disabled={saving}
          >
            Salvar
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <label className="block text-sm font-medium text-gray-600 mb-2">Valor</label>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-gray-800">R$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              step="0.01"
              className="text-3xl font-bold text-gray-800 w-40 text-center border-b-2 border-[#5BC5A7] focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Descricao</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Churrasco, Mercado, Uber..."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent"
          />
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">Quem pagou?</label>
          <div className="space-y-2">
            {group.participantsList.map((participant) => (
              <button
                key={participant.id}
                onClick={() => setPayerId(participant.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  payerId === participant.id ? 'border-[#5BC5A7] bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                type="button"
              >
                <div className="w-10 h-10 bg-[#5BC5A7] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">{participant.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">{participant.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">Como dividir?</label>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSplitType('equal')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                splitType === 'equal' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              type="button"
            >
              Igual para todos
            </button>
            <button
              onClick={() => setSplitType('manual')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                splitType === 'manual' ? 'bg-[#5BC5A7] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              type="button"
            >
              Manual
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-600 mb-2">
              Selecione quem participou ({selectedParticipants.length} {selectedParticipants.length === 1 ? 'pessoa' : 'pessoas'})
            </p>
            {group.participantsList.map((participant) => {
              const isSelected = selectedParticipants.includes(participant.id)
              const splitAmountPreview = amount && selectedParticipants.length > 0
                ? (parseFloat(amount) / selectedParticipants.length).toFixed(2)
                : '0.00'

              return (
                <button
                  key={participant.id}
                  onClick={() => toggleParticipant(participant.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    isSelected ? 'border-[#5BC5A7] bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#5BC5A7]' : 'bg-gray-300'}`}>
                      <span className="text-white font-medium text-sm">{participant.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{participant.name}</p>
                  </div>
                  {isSelected && <p className="text-sm font-medium text-[#5BC5A7]">R$ {splitAmountPreview}</p>}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-[#5BC5A7] text-white rounded-xl font-medium hover:bg-[#4AB396] transition-colors shadow-sm"
          type="button"
        >
          {saving ? 'Salvando...' : 'Salvar gasto'}
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
