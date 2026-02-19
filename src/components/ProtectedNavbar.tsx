'use client'

import { useAuth } from '@/context/AuthContext'
import Navbar from '@/components/Navbar'

export default function ProtectedNavbar() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return null

  return <Navbar />
}

