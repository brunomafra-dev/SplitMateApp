'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { savePendingInviteToken } from '@/lib/invites'

export default function InviteTokenPage() {
  const params = useParams()
  const router = useRouter()
  const token = String(params.token || '')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Processando convite...')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        if (!token) {
          setMessage('Convite invalido')
          return
        }

        const { data: invite, error: inviteError } = await supabase
          .from('invite_tokens')
          .select('group_id,expires_at')
          .eq('token', token)
          .single()

        if (inviteError || !invite) {
          setMessage('Convite invalido')
          return
        }

        if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
          setMessage('Convite expirado')
          return
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('invite.session-error', sessionError)
          setMessage('Erro ao validar sessao')
          return
        }

        const user = session?.user ?? null
        if (!user) {
          savePendingInviteToken(token)
          router.replace(`/signup?invite=${encodeURIComponent(token)}`)
          return
        }

        const { data: existingParticipant, error: existingParticipantError } = await supabase
          .from('participants')
          .select('id')
          .eq('group_id', invite.group_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingParticipantError) {
          console.error('invite.participant-check-error', existingParticipantError)
          setMessage('Erro ao validar participacao')
          return
        }

        if (!existingParticipant) {
          const { error: insertError } = await supabase
            .from('participants')
            .insert({
              group_id: invite.group_id,
              user_id: user.id,
              role: 'member',
            })

          if (insertError && insertError.code !== '23505') {
            console.error('invite.participant-insert-error', insertError)
            setMessage('Erro ao entrar no grupo')
            return
          }
        }

        const { data: groupRow, error: groupError } = await supabase
          .from('groups')
          .select('id')
          .eq('id', invite.group_id)
          .single()

        if (groupError || !groupRow) {
          console.error('invite.group-lookup-error', groupError)
          setMessage('Grupo nao encontrado')
          return
        }

        router.replace(`/group/${invite.group_id}`)
        router.refresh()
      } catch (error) {
        console.error(error)
        setMessage('Erro ao processar convite')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [router, token])

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full max-w-md text-center">
        <p className="text-gray-700">{loading ? 'Processando convite...' : message}</p>
      </div>
    </div>
  )
}
