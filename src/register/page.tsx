'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister() {
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

    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7] px-6">
      <div className="bg-white p-6 rounded-xl shadow-sm w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">Criar conta</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded-lg px-4 py-2"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full border rounded-lg px-4 py-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-[#5BC5A7] text-white py-2 rounded-lg"
        >
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </div>
    </div>
  )
}

