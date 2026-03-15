'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '@/components/ui/bottom-nav'
import packageJson from '../../../../package.json'

export default function AboutPage() {
  const version = String((packageJson as { version?: string }).version || '0.0.0')

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-[calc(6rem+env(safe-area-inset-bottom))] page-fade">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/settings">
            <button type="button" className="tap-target pressable text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">Sobre o app</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="surface-card p-5 space-y-2 text-sm text-gray-700">
          <p><strong>Aplicativo:</strong> SplitMate</p>
          <p><strong>Versão atual:</strong> {version}</p>
          <p><strong>Stack:</strong> Next.js + Supabase</p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

