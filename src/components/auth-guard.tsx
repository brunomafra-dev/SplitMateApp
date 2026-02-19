'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Verificar se está na página de login
    if (pathname === '/login') {
      return
    }

    // Verificar se usuário está logado
    const isLoggedIn = localStorage.getItem('divideai_logged_in')
    const keepLoggedIn = localStorage.getItem('divideai_keep_logged_in')

    // Se não está logado OU não marcou "manter logado"
    if (isLoggedIn !== 'true' || keepLoggedIn !== 'true') {
      // Limpar dados de sessão
      localStorage.removeItem('divideai_logged_in')
      
      // Redirecionar para login
      router.push('/login')
    }
  }, [pathname, router])

  return <>{children}</>
}
