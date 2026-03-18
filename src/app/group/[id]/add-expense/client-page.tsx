'use client'



import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import UserAvatar from '@/components/user-avatar'
import { sanitizeMoney } from '@/lib/money'
import { buildEqualSplits, buildWeightedSplits } from '@/lib/transaction-splits'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface Participant {
  id: string
  name: string
  avatarKey?: string
  isPremium?: boolean
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
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

      const participantSelectCandidates = [
        'id,user_id,display_name',
        'id,user_id',
        'user_id',
      ]
      let participantRows: Array<{ id?: string; user_id?: string; display_name?: string }> | null = null
      let participantsError: any = null

      for (const selectClause of participantSelectCandidates) {
        const attempt = await supabase
          .from('participants')
          .select(selectClause)
          .eq('group_id', groupId)

        if (!attempt.error) {
          participantRows = ((attempt.data as Array<{ id?: string; user_id?: string; display_name?: string }> | null) ?? [])
          participantsError = null
          break
        }

        participantsError = attempt.error
      }

      if (participantsError) {
        console.error('add-expense.participants-load-error', participantsError)
        router.replace(`/group/${groupId}`)
        return
      }

      const participantRowsSafe = (participantRows ?? [])
      const participantIds = participantRowsSafe
        .map((row) => String(row.user_id || '').trim())
        .filter(Boolean)

      let profileMap = new Map<string, { username?: string; full_name?: string; avatar_key?: string; is_premium?: boolean }>()
      if (participantIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('id,username,full_name,avatar_key,is_premium')
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
              avatar_key: String((row as { avatar_key?: string }).avatar_key || '').trim(),
              is_premium: Boolean((row as { is_premium?: boolean }).is_premium),
            })
          }
        }
      }

      const participantsList: Participant[] = participantRowsSafe
        .map((row) => {
          const userId = String(row.user_id || '').trim()
          if (userId) {
            const profile = profileMap.get(userId)
            return {
              id: userId,
              name: profile?.username || profile?.full_name || 'usuario',
              avatarKey: profile?.avatar_key || '',
              isPremium: Boolean(profile?.is_premium),
            }
          }

          const manualId = String(row.id || '').trim()
          return {
            id: manualId,
            name: String(row.display_name || 'Participante').trim() || 'Participante',
            avatarKey: '',
            isPremium: false,
          }
        })
        .filter((participant) => Boolean(participant.id))
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
      const initialWeights: Record<string, number> = {}
      for (const participant of participantsList) {
        initialWeights[participant.id] = 1
      }
      setWeights(initialWeights)
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

  const participantsForSplit = useMemo(() => {
    return Array.from(
      new Set(
        (selectedParticipants.length > 0 ? [...selectedParticipants, payerId] : [payerId])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    )
  }, [payerId, selectedParticipants])

  const normalizedAmount = useMemo(() => {
    const parsed = parseFloat(amount)
    return Number.isFinite(parsed) && parsed > 0 ? sanitizeMoney(parsed) : 0
  }, [amount])

  const splitPreview = useMemo(() => {
    if (!normalizedAmount || participantsForSplit.length === 0) return {} as Record<string, number>

    if (splitType === 'manual') {
      const manualWeights: Record<string, number> = { ...weights }
      if ((manualWeights[payerId] ?? 0) <= 0) {
        manualWeights[payerId] = 1
      }
      const manualParticipants = participantsForSplit.filter((id) => Number(manualWeights[id] || 0) > 0)
      if (!manualParticipants.includes(payerId)) {
        manualParticipants.push(payerId)
      }
      return buildWeightedSplits(normalizedAmount, manualParticipants, manualWeights)
    }

    return buildEqualSplits(normalizedAmount, participantsForSplit)
  }, [normalizedAmount, participantsForSplit, payerId, splitType, weights])

  const handleSave = async () => {
    if (!amount || !description || !payerId) {
      setFeedback({ type: 'error', text: 'Preencha todos os campos.' })
      return
    }

    const amountValue = parseFloat(amount)
    if (isNaN(amountValue) || amountValue <= 0) {
      setFeedback({ type: 'error', text: 'Valor invalido.' })
      return
    }

    if (!group) return

    if (participantsForSplit.length === 0) {
      setFeedback({ type: 'error', text: 'Selecione pelo menos um participante.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setFeedback({ type: 'error', text: 'Usuário não autenticado.' })
      return
    }

    const allowed = checkRateLimit(user.id, 'createExpense', RATE_LIMITS.createExpense)
    if (!allowed) {
      setSaving(false)
      setFeedback({ type: 'error', text: 'Muitas ações em pouco tempo. Tente novamente.' })
      return
    }

    const normalizedAmountValue = sanitizeMoney(amountValue)

    let splits: Record<string, number> = {}
    let participantsPayload = [...participantsForSplit]

    if (splitType === 'manual') {
      const manualWeights: Record<string, number> = { ...weights }
      if ((manualWeights[payerId] ?? 0) <= 0) {
        manualWeights[payerId] = 1
      }
      const manualParticipants = participantsForSplit.filter((id) => Number(manualWeights[id] || 0) > 0)
      if (!manualParticipants.includes(payerId)) {
        manualParticipants.push(payerId)
      }
      participantsPayload = Array.from(new Set(manualParticipants))
      splits = buildWeightedSplits(normalizedAmountValue, participantsPayload, manualWeights)
    } else {
      participantsPayload = [...participantsForSplit]
      splits = buildEqualSplits(normalizedAmountValue, participantsPayload)
    }

    if (Object.keys(splits).length === 0) {
      setSaving(false)
      setFeedback({
        type: 'error',
        text: splitType === 'manual'
          ? 'Divisão manual inválida. Ajuste os pesos dos participantes.'
          : 'Divisão inválida para este gasto.',
      })
      return
    }

    const basePayload = {
      group_id: groupId,
      value: normalizedAmountValue,
      description: description.trim(),
      payer_id: payerId,
    }

    let { error } = await supabase.from('transactions').insert({
      ...basePayload,
      participants: participantsPayload,
      splits,
    })

    if (error?.code === 'PGRST204' && error.message?.includes("'participants'")) {
      const retry = await supabase.from('transactions').insert({
        ...basePayload,
        splits,
      })
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
          participants: participantsPayload,
          value: normalizedAmountValue,
        },
      })
      setFeedback({ type: 'error', text: 'Erro ao salvar gasto.' })
      return
    }

    setFeedback({ type: 'success', text: 'Gasto salvo com sucesso.' })
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
        <p className="text-gray-600">Grupo não encontrado</p>
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
        {feedback && (
          <div className={`rounded-lg px-3 py-2 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {feedback.text}
          </div>
        )}
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
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all focus:outline-none ${
                  payerId === participant.id
                    ? 'border-[#5BC5A7] bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-400/70'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
                }`}
                type="button"
              >
                <UserAvatar name={participant.name} avatarKey={participant.avatarKey} isPremium={participant.isPremium} className="w-10 h-10" />
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
              const splitAmountPreview = Number(splitPreview[participant.id] || 0).toFixed(2)

              return (
                <button
                  key={participant.id}
                  onClick={() => toggleParticipant(participant.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all focus:outline-none ${
                    isSelected
                      ? 'border-[#5BC5A7] bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-400/70'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
                  }`}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar name={participant.name} avatarKey={participant.avatarKey} isPremium={participant.isPremium} className="w-10 h-10" />
                    <p className="text-sm font-medium text-gray-800">{participant.name}</p>
                  </div>
                  {isSelected && <p className="text-sm font-medium text-[#5BC5A7]">R$ {splitAmountPreview}</p>}
                </button>
              )
            })}
          </div>

          {splitType === 'manual' && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-600">Defina o peso de cada participante (0 = não participa)</p>
              {group.participantsList.map((participant) => {
                const currentWeight = Number(weights[participant.id] ?? (participant.id === payerId ? 1 : 0))
                return (
                  <div key={`weight-${participant.id}`} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                    <span className="flex items-center gap-3">
                      <UserAvatar name={participant.name} avatarKey={participant.avatarKey} isPremium={participant.isPremium} className="w-8 h-8" textClassName="text-xs" />
                      <span className="text-sm text-gray-700">{participant.name}</span>
                    </span>
                    <input
                      type="number"
                      min={participant.id === payerId ? 1 : 0}
                      step="1"
                      value={currentWeight}
                      onChange={(e) => {
                        const next = Number(e.target.value)
                        setWeights((prev) => ({
                          ...prev,
                          [participant.id]: Number.isFinite(next) ? next : 0,
                        }))
                      }}
                      className="w-20 border border-gray-300 rounded p-1 text-center text-sm"
                    />
                  </div>
                )
              })}
            </div>
          )}
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
