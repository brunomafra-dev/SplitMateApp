'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, User, AtSign } from 'lucide-react'
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

export default function SignUpPage() {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [termsViewed, setTermsViewed] = useState(false)
  const [privacyViewed, setPrivacyViewed] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)
  const [showBrandLogo, setShowBrandLogo] = useState(true)

  const checkUsernameAvailability = async (rawValue?: string) => {
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

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

    const available = await checkUsernameAvailability(cleanUsername)
    if (!available) {
      setError('Esse nome de usuário já está em uso. Escolha outro.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas Não coincidem')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }

    if (!acceptedLegal) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
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

      if (signUpError) throw signUpError
      if (!data.user) throw new Error('Não foi possível criar usuário')

      savePendingProfileSeed({
        userId: data.user.id,
        username: cleanUsername,
        fullName: cleanFullName,
      })

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
          setError('Esse username já está em uso. Escolha outro.')
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
        window.location.href = '/'
        return
      }

      setError('Cadastro realizado! Verifique seu email para confirmar a conta.')
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar conta')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {showBrandLogo ? (
            <img
              src="/logo/splitmate-logo.svg"
              alt="SplitMate"
              className="h-12 w-auto mx-auto mb-2"
              onError={() => setShowBrandLogo(false)}
            />
          ) : (
            <h1 className="text-4xl font-bold text-white mb-2">SplitMate</h1>
          )}
          <p className="text-white/90 text-lg">Divida gastos com facilidade</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Criar Conta</h2>

          {error && (
            <div className={`${error.includes('realizado') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} border px-4 py-3 rounded-lg mb-4 text-sm`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Nome completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Nome de usuário
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setUsernameStatus('idle')
                  }}
                  onBlur={() => {
                    if (username.trim()) {
                      void checkUsernameAvailability()
                    }
                  }}
                  placeholder="seu_usuario"
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent outline-none transition-all"
                />
              </div>
              <p className="text-xs mt-2 text-gray-500">
                {checkingUsername
                  ? 'Verificando disponibilidade...'
                  : usernameStatus === 'available'
                    ? 'Nome de usuário disponível'
                    : usernameStatus === 'taken'
                      ? 'Nome de usuário indisponível'
                      : 'Use letras, numeros e underscore'}
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#5BC5A7] text-white py-3 rounded-lg font-medium hover:bg-[#4AB396] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
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
                  disabled={!termsViewed || !privacyViewed}
                  onChange={(e) => {
                    if (!termsViewed || !privacyViewed) {
                      setError('Leia os Termos e a Política antes de aceitar.')
                      return
                    }
                    setAcceptedLegal(e.target.checked)
                  }}
                  className="mt-1"
                />
                <span>Li e aceito os Termos de Uso e a Política de Privacidade</span>
              </label>
              {(!termsViewed || !privacyViewed) && (
                <p className="text-xs text-gray-500">Você precisa abrir e ler os dois documentos para habilitar o aceite.</p>
              )}
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-600">
              Ja tem uma conta?{' '}
              <Link href="/login" className="text-[#5BC5A7] font-medium hover:text-[#4AB396] transition-colors">
                Entrar
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-white/80 text-sm mt-6">
          Ao continuar, Você concorda com nossos Termos de Uso
        </p>
      </div>

      <LegalDocModal
        open={legalModal !== null}
        type={legalModal || 'terms'}
        onClose={() => setLegalModal(null)}
        onViewed={() => {
          if (legalModal === 'terms') setTermsViewed(true)
          if (legalModal === 'privacy') setPrivacyViewed(true)
        }}
      />
    </div>
  )
}



