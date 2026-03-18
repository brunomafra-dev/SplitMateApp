'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAuthRedirectUrl } from '@/lib/site-url'
import { ensureProfileForUser, savePendingProfileSeed } from '@/lib/profiles'
import LegalDocModal from '@/components/legal-doc-modal'

function normalizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function RegisterPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)

  async function checkUsernameAvailability(rawValue?: string) {
    const candidate = normalizeUsername(rawValue ?? username)
    if (!candidate) {
      setUsernameStatus('idle')
      return false
    }

    setCheckingUsername(true)
    try {
      const { data, error: availabilityError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', candidate)
        .maybeSingle()

      if (availabilityError) {
        setUsernameStatus('idle')
        return true
      }

      const available = !data
      setUsernameStatus(available ? 'available' : 'taken')
      return available
    } finally {
      setCheckingUsername(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const cleanUsername = normalizeUsername(username)
    const cleanFullName = fullName.trim()

    if (!cleanUsername) {
      setError('Username invalido. Use letras, numeros e underscore.')
      setLoading(false)
      return
    }

    if (!cleanFullName) {
      setError('Nome completo e obrigatorio')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas Não coincidem')
      setLoading(false)
      return
    }

    if (!acceptedLegal) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
      setLoading(false)
      return
    }

    const available = await checkUsernameAvailability(cleanUsername)
    if (!available) {
      setError('Esse nome de usuário ja esta em uso. Escolha outro.')
      setLoading(false)
      return
    }

    try {
      const redirectTo = getAuthRedirectUrl('/auth/callback')

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            username: cleanUsername,
            full_name: cleanFullName,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError('Não foi possivel criar usuário')
        setLoading(false)
        return
      }

      savePendingProfileSeed({ userId: data.user.id, username: cleanUsername, fullName: cleanFullName })

      try {
        await ensureProfileForUser(data.user, {
          username: cleanUsername,
          fullName: cleanFullName,
        })
      } catch (profileError: any) {
        const profileMessage = String(profileError?.message || '').toLowerCase()
        const profileCode = String(profileError?.code || '')
        const duplicate = profileCode === '23505' || profileMessage.includes('username_already_taken') || profileMessage.includes('duplicate')

        if (duplicate) {
          await supabase.auth.signOut()
          setError('Esse username ja esta em uso. Escolha outro.')
          setLoading(false)
          return
        }

        if (data.session) {
          await supabase.auth.signOut()
          setError('Falha ao criar perfil. Tente novamente.')
          setLoading(false)
          return
        }
      }

      if (data.session) {
        await supabase
          .from('profiles')
          .update({
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString(),
          })
          .eq('id', data.user.id)
        router.replace('/')
        return
      }

      setSuccess('Cadastro realizado! Verifique seu email para confirmar a conta.')
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar conta')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7] px-4">
      <form
        onSubmit={handleRegister}
        className="bg-white w-full max-w-sm p-6 rounded-xl shadow-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-gray-800 text-center">
          Criar conta
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#5BC5A7]"
        />

        <input
          type="text"
          placeholder="Nome completo"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#5BC5A7]"
        />

        <input
          type="text"
          placeholder="Nome de usuário"
          value={username}
          onChange={e => {
            setUsername(e.target.value)
            setUsernameStatus('idle')
          }}
          onBlur={() => {
            if (username.trim()) {
              void checkUsernameAvailability()
            }
          }}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#5BC5A7]"
        />
        <p className="text-xs text-gray-500 -mt-2">
          {checkingUsername
            ? 'Verificando disponibilidade...'
            : usernameStatus === 'available'
              ? 'Nome de usuário disponivel'
              : usernameStatus === 'taken'
                ? 'Nome de usuário indisponivel'
                : 'Use letras, numeros e underscore'}
        </p>

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#5BC5A7]"
        />

        <input
          type="password"
          placeholder="Repetir senha"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#5BC5A7]"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#5BC5A7] text-white py-2 rounded-lg font-medium disabled:opacity-60"
        >
          {loading ? 'Criando conta...' : 'Registrar'}
        </button>

        <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-2">
          <button
            type="button"
            onClick={() => setLegalModal('terms')}
            className="text-sm text-[#5BC5A7] underline"
          >
            Ler Termos de Uso
          </button>
          <button
            type="button"
            onClick={() => setLegalModal('privacy')}
            className="ml-3 text-sm text-[#5BC5A7] underline"
          >
            Ler Política de Privacidade
          </button>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="mt-1"
            />
            <span>Li e aceito os Termos de Uso e a Política de Privacidade</span>
          </label>
        </div>

        <p className="text-sm text-center text-gray-500">
          Ja tem conta?{' '}
          <Link href="/login" className="text-[#5BC5A7] font-medium">
            Entrar
          </Link>
        </p>
      </form>

      <LegalDocModal
        open={legalModal !== null}
        type={legalModal || 'terms'}
        onClose={() => setLegalModal(null)}
        onViewed={() => {}}
      />
    </div>
  )
}

