'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GroupsPageRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
      <p className="text-gray-600">Carregando...</p>
    </div>
  )
}

