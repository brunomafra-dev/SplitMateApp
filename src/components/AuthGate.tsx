'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublicRoute = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password'

  useEffect(() => {
    if (loading) return

    // Se não tem usuário e não está em rota pública, redireciona para login
    if (!user && !isPublicRoute) {
      router.replace('/login')
    }

    // Se tem usuário e está em rota pública, redireciona para home
    if (user && isPublicRoute) {
      router.replace('/')
    }
  }, [user, loading, isPublicRoute, router, pathname])

  // Mostrar loading enquanto verifica sessão
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] flex items-center justify-center">
        <div className="text-white text-lg">Carregando...</div>
      </div>
    )
  }

  // Se não tem usuário e não está em rota pública, não renderiza nada (vai redirecionar)
  if (!user && !isPublicRoute) {
    return null
  }

  // Se tem usuário e está em rota pública, não renderiza nada (vai redirecionar)
  if (user && isPublicRoute) {
    return null
  }

  return <>{children}</>
}
