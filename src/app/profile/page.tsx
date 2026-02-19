'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogOut, User, Mail } from 'lucide-react'
import Link from 'next/link'

interface UserProfile {
  email: string
  full_name?: string
  avatar_url?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setProfile({
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          avatar_url: user.user_metadata?.avatar_url || '',
        })
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0]
    }
    return name.substring(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#5BC5A7] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Perfil</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'Avatar'}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(profile?.full_name || profile?.email || 'U')
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {profile?.full_name || 'Usuário'}
            </h2>
            <p className="text-gray-600">{profile?.email}</p>
          </div>

          {/* Info Cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-[#5BC5A7]" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Nome</p>
                <p className="font-medium text-gray-800">
                  {profile?.full_name || 'Não informado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-[#5BC5A7]" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">E-mail</p>
                <p className="font-medium text-gray-800">{profile?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
        >
          <LogOut className="w-5 h-5" />
          Sair da conta
        </button>

        {/* App Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Divide Aí v1.0</p>
          <p className="mt-1">Divida gastos com facilidade</p>
        </div>
      </main>
    </div>
  )
}
