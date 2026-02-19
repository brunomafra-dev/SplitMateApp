
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // ✅ Login automático depois de registrar
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

    router.replace('/')
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
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#5BC5A7]"
        />

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#5BC5A7] text-white py-2 rounded-lg font-medium disabled:opacity-60"
        >
          {loading ? 'Criando conta...' : 'Registrar'}
        </button>

        <p className="text-sm text-center text-gray-500">
          Já tem conta?{' '}
          <Link href="/login" className="text-[#5BC5A7] font-medium">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  )
}
