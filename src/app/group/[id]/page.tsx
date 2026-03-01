'use client'

import { ArrowLeft, Plus, TrendingUp, TrendingDown, Settings, UserPlus, Copy, X } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateUserBalance, type BalancePayment, type BalanceTransaction } from '@/lib/balance'
import { generateSecureInviteToken } from '@/lib/invites'
import { buildInviteLink } from '@/lib/site-url'
import BottomNav from '@/components/ui/bottom-nav'

interface Participant {
  id: string
  user_id?: string
  display_name?: string
  name: string
  avatar_url?: string
  email?: string
}

interface TransactionRow extends BalanceTransaction {
  description: string
  created_at?: string
}

interface PaymentRow extends BalancePayment {}
interface ParticipantUserRow {
  user_id: string
  role?: string
}

interface GroupRow {
  id: string
  name: string
  category: string
  owner_id?: string
}

interface Group {
  id: string
  name: string
  category: string
  totalSpent: number
  balance: number
  participants: number
  participantsList: Participant[]
  transactions: Array<{
    id: string
    description: string
    amount: number
    payerId: string
    payerName: string
    date: string
    participants: string[]
  }>
}

export default function GroupPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [group, setGroup] = useState<Group | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [showParticipantModal, setShowParticipantModal] = useState(false)
  const [manualParticipantName, setManualParticipantName] = useState('')
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const isMountedRef = useRef(true)

  const loadGroup = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('id,name,category,owner_id')
      .eq('id', groupId)
      .single()

    if (groupError || !groupRow) {
      console.error('group.load-error', groupError)
      setLoading(false)
      router.replace('/')
      return
    }

    const { data: participantRows, error: participantsError } = await supabase
      .from('participants')
      .select('user_id,role')
      .eq('group_id', groupId)

    if (participantsError) {
      console.error('group.participants-load-error', participantsError)
    }

    const participantUsers = ((participantRows as ParticipantUserRow[] | null) ?? [])
      .map((row) => String(row.user_id || '').trim())
      .filter(Boolean)

    let profileMap = new Map<string, { username?: string; full_name?: string }>()
    if (participantUsers.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id,username,full_name')
        .in('id', participantUsers)

      if (profilesError) {
        console.error('group.profiles-load-error', profilesError)
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

    const tableParticipants: Participant[] = participantUsers.map((userId) => {
      const profile = profileMap.get(userId)
      const display = String(profile?.username || profile?.full_name || 'Usuario').trim()
      return {
        id: userId,
        user_id: userId,
        name: display || 'Usuario',
        display_name: display || 'Usuario',
      }
    })

    const participantsList: Participant[] = tableParticipants

    const { data: txRows, error: txError } = await supabase
      .from('transactions')
      .select('id,group_id,value,payer_id,description,created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (txError) {
      console.error('group.transactions-load-error', txError)
    }

    const { data: payRows, error: payError } = await supabase
      .from('payments')
      .select('group_id,from_user,to_user,amount')
      .eq('group_id', groupId)

    if (payError) {
      console.error('group.payments-load-error', payError)
    }

    let { data: myRoleRow, error: myRoleError } = await supabase
      .from('participants')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .maybeSingle()

    if (myRoleError) {
      console.error('group.role-load-error', myRoleError)
    }

    if (!myRoleRow && String(groupRow.owner_id || '') === currentUserId) {
      const { error: ownerInsertError } = await supabase.from('participants').insert({
        group_id: groupId,
        user_id: currentUserId,
        role: 'owner',
      })

      if (ownerInsertError && ownerInsertError.code !== '23505') {
        console.error('group.owner-participant-repair-error', ownerInsertError)
      } else {
        const { data: repairedRoleRow, error: repairedRoleError } = await supabase
          .from('participants')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', currentUserId)
          .maybeSingle()

        if (repairedRoleError) {
          console.error('group.role-reload-error', repairedRoleError)
        } else {
          myRoleRow = repairedRoleRow
        }
      }
    }

    const activeParticipantIds = participantsList.map((p) => String(p.user_id || p.id))
    const safeTx: TransactionRow[] = ((txRows as TransactionRow[] | null) ?? []).map((tx) => ({
      ...tx,
      value: Number(tx.value) || 0,
      participants: activeParticipantIds,
    }))

    const safePayments: PaymentRow[] = ((payRows as PaymentRow[] | null) ?? []).map((p) => ({
      ...p,
      amount: Number(p.amount) || 0,
    }))

    const summary = calculateUserBalance(safeTx, currentUserId, safePayments)

    const transactions = safeTx.map((tx) => {
      const payer = participantsList.find((p) => String(p.user_id || p.id) === tx.payer_id)
      return {
        id: tx.id,
        description: tx.description,
        amount: tx.value,
        payerId: tx.payer_id,
        payerName: tx.payer_id === currentUserId ? 'Voce' : payer?.name || 'Alguem',
        date: tx.created_at || new Date().toISOString(),
        participants: tx.participants || [],
      }
    })

    if (!isMountedRef.current) return

    setGroup({
      id: groupRow.id,
      name: groupRow.name,
      category: groupRow.category,
      totalSpent: summary.totalSpent,
      balance: summary.balance,
      participants: participantsList.length,
      participantsList,
      transactions,
    })
    setIsOwner(String(myRoleRow?.role || '') === 'owner')

    setLoading(false)
  }, [currentUserId, groupId, router])

  const handleCreateInvite = useCallback(async () => {
    if (!currentUserId || !group) return

    setInviteLoading(true)
    try {
      const token = generateSecureInviteToken()
      const { error } = await supabase.from('invite_tokens').insert({
        group_id: group.id,
        created_by: currentUserId,
        token,
      })

      if (error) {
        throw error
      }

      const link = buildInviteLink(token)
      setInviteLink(link)
      await navigator.clipboard.writeText(link)
    } catch (error) {
      console.error('group.create-invite-error', error)
    } finally {
      setInviteLoading(false)
    }
  }, [currentUserId, group])

  const handleCopyInviteLink = useCallback(async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
  }, [inviteLink])

  const handleShareInvite = useCallback(async () => {
    if (!inviteLink) return
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: `Convite - ${group?.name || 'Divide Ai'}`,
        text: `Entre no grupo ${group?.name || ''}`.trim(),
        url: inviteLink,
      })
      return
    }
    await handleCopyInviteLink()
  }, [group?.name, handleCopyInviteLink, inviteLink])

  const whatsappShareUrl = inviteLink
    ? `https://wa.me/?text=${encodeURIComponent(`Entre no meu grupo no Divide Ai: ${inviteLink}`)}`
    : ''

  const handleAddManualParticipant = useCallback(async () => {
    if (!group || !manualParticipantName.trim()) return

    const newParticipant = {
      id: crypto.randomUUID(),
      name: manualParticipantName.trim(),
    }

    const nextParticipants = [...group.participantsList, newParticipant]
    const { error } = await supabase
      .from('groups')
      .update({ participants: nextParticipants })
      .eq('id', group.id)

    if (!error) {
      setManualParticipantName('')
      setShowParticipantModal(false)
      await loadGroup()
    }
  }, [group, manualParticipantName, loadGroup])

  useEffect(() => {
    const resolveSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setCurrentUserId(null)
        setAuthLoading(false)
        setLoading(false)
        return
      }

      setCurrentUserId(session.user.id)
      setAuthLoading(false)
    }

    isMountedRef.current = true
    resolveSession()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!currentUserId) {
      router.replace('/login')
      return
    }
    loadGroup()
  }, [authLoading, currentUserId, loadGroup, router])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`group-realtime-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `group_id=eq.${groupId}` },
        () => {
          loadGroup()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `group_id=eq.${groupId}` },
        () => {
          loadGroup()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        () => {
          loadGroup()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, groupId, loadGroup])

  if (authLoading || loading) {
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

  const amountPerPerson = group.participants > 0 ? group.totalSpent / group.participants : 0
  const topParticipants = group.participantsList.slice(0, 4)
  const extraParticipants = Math.max(0, group.participantsList.length - 4)

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">{group.name}</h1>
          {isOwner ? (
            <Link href={`/group/${groupId}/settings`}>
              <button className="text-gray-600 hover:text-gray-800" type="button">
                <Settings className="w-6 h-6" />
              </button>
            </Link>
          ) : (
            <div className="w-6" />
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {topParticipants.map((participant, index) => {
              const initial = String(participant.name || participant.display_name || '?').charAt(0).toUpperCase()
              return (
                <div
                  key={String(participant.user_id || participant.id)}
                  className="w-10 h-10 rounded-full border-2 border-white bg-[#5BC5A7] text-white flex items-center justify-center text-sm font-semibold overflow-hidden"
                  style={{ marginLeft: index > 0 ? '-10px' : '0' }}
                >
                  {participant.avatar_url ? (
                    <img
                      src={participant.avatar_url}
                      alt={participant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </div>
              )
            })}
            {extraParticipants > 0 && (
              <div
                className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold"
                style={{ marginLeft: '-10px' }}
              >
                +{extraParticipants}
              </div>
            )}
            {group.participantsList.length === 1 && (
              <p className="text-sm text-gray-500 ml-3">Aguardando participantes...</p>
            )}
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowParticipantModal(true)}
              className="w-8 h-8 rounded-full bg-[#5BC5A7] text-white hover:bg-[#4AB396] flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>
      </div>

      {inviteLink && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3 space-y-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
            />
            <div className="flex items-center gap-2">
              {canNativeShare ? (
                <button
                  type="button"
                  onClick={handleShareInvite}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Compartilhar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </button>
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                  >
                    WhatsApp
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showParticipantModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Adicionar participante</h3>
              <button onClick={() => setShowParticipantModal(false)} type="button" className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Participante manual</label>
              <input
                type="text"
                value={manualParticipantName}
                onChange={(e) => setManualParticipantName(e.target.value)}
                placeholder="Nome do participante"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleAddManualParticipant}
                className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
                type="button"
              >
                Adicionar manualmente
              </button>
            </div>

            <div className="pt-2 border-t border-gray-200 space-y-2">
              <button
                onClick={async () => {
                  await handleCreateInvite()
                }}
                disabled={inviteLoading}
                className="w-full py-2 bg-[#5BC5A7] text-white rounded-lg font-medium hover:bg-[#4AB396] disabled:opacity-60 flex items-center justify-center gap-2"
                type="button"
              >
                <UserPlus className="w-4 h-4" />
                {inviteLoading ? 'Gerando...' : 'Gerar link de convite'}
              </button>
              {inviteLink && (
                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
                  />
                  <div className="flex items-center gap-2">
                    {canNativeShare ? (
                      <button
                        type="button"
                        onClick={handleShareInvite}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                      >
                        Compartilhar
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyInviteLink}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar link
                        </button>
                        <a
                          href={whatsappShareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total gasto</p>
              <p className="text-2xl font-bold text-gray-800">R$ {group.totalSpent.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Seu saldo</p>
              {group.balance === 0 ? (
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl font-bold text-gray-800">R$ 0,00</p>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">zerado</span>
                </div>
              ) : group.balance > 0 ? (
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#5BC5A7]" />
                  <p className="text-2xl font-bold text-[#5BC5A7]">R$ {group.balance.toFixed(2)}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <TrendingDown className="w-5 h-5 text-[#FF6B6B]" />
                  <p className="text-2xl font-bold text-[#FF6B6B]">R$ {Math.abs(group.balance).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {group.totalSpent > 0 && (
        <div className="bg-[#5BC5A7]/10 border-b border-[#5BC5A7]/20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="text-center">
              <p className="text-sm text-gray-700 mb-1">Cada pessoa fica com:</p>
              <p className="text-2xl font-bold text-[#5BC5A7]">R$ {amountPerPerson.toFixed(2)}</p>
              <p className="text-xs text-gray-600 mt-1">
                Total dividido por {group.participants} {group.participants === 1 ? 'pessoa' : 'pessoas'}
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {group.transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum gasto ainda</h3>
            <p className="text-gray-600 mb-6">Adicione o primeiro gasto do grupo</p>
            <Link href={`/group/${groupId}/add-expense`}>
              <button className="bg-[#5BC5A7] text-white px-6 py-3 rounded-lg hover:bg-[#4AB396] transition-colors" type="button">
                Adicionar gasto
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Gastos</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{group.transactions.length} {group.transactions.length === 1 ? 'gasto' : 'gastos'}</span>
                <Link href={`/group/${groupId}/add-expense`}>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#5BC5A7] text-white text-sm rounded-lg hover:bg-[#4AB396]"
                  >
                    Adicionar gasto
                  </button>
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {group.transactions.map((transaction) => {
                const transactionParticipants = group.participantsList.filter((p) => transaction.participants.includes(String(p.user_id || p.id)))
                const displayParticipants = transactionParticipants.slice(0, 3)
                const remainingCount = transactionParticipants.length - 3

                return (
                  <Link key={transaction.id} href={`/group/${groupId}/edit-expense/${transaction.id}`}>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-gray-800 mb-1 truncate">{transaction.description}</h3>
                          <p className="text-sm text-gray-600">{transaction.payerName} pagou</p>
                          <div className="flex items-center gap-1 mt-2">
                            {displayParticipants.map((participant, index) => (
                              <div
                                key={String(participant.user_id || participant.id)}
                                className="w-6 h-6 bg-[#5BC5A7] rounded-full flex items-center justify-center text-white text-xs font-medium"
                                style={{ marginLeft: index > 0 ? '-8px' : '0' }}
                              >
                                {participant.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {remainingCount > 0 && (
                              <div
                                className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 text-xs font-medium"
                                style={{ marginLeft: '-8px' }}
                              >
                                +{remainingCount}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-gray-800 shrink-0">R$ {transaction.amount.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <span>{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                        <span>{transaction.participants.length} {transaction.participants.length === 1 ? 'pessoa' : 'pessoas'}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>

      <div className="max-w-4xl w-full mx-auto px-4 py-4">
        <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
          <p className="text-xs text-gray-500">Espaco reservado para anuncio</p>
        </div>
      </div>

      <Link href={`/group/${groupId}/add-expense`}>
        <button className="fixed right-6 w-16 h-16 bg-[#5BC5A7] rounded-full flex items-center justify-center shadow-lg hover:bg-[#4AB396] transition-all hover:scale-110 z-40 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" type="button">
          <Plus className="w-8 h-8 text-white" />
        </button>
      </Link>
      <BottomNav />
    </div>
  )
}
