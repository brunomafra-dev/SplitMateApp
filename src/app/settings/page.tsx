'use client'

import { ArrowLeft, Crown } from 'lucide-react'
import Link from 'next/link'
import BottomNav from '@/components/ui/bottom-nav'

export default function Settings() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Configurações</h1>
          <div className="w-6"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Premium */}
        <div className="bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center gap-3 mb-3">
            <Crown className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Divide Aí Premium</h2>
          </div>
          <p className="text-white/90 mb-4">
            Remova anúncios, tenha grupos ilimitados e exporte relatórios em PDF
          </p>
          <button className="w-full bg-white text-[#5BC5A7] py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
            Assinar Premium - R$ 9,90/mês
          </button>
        </div>

        {/* Conta */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-sm font-medium text-gray-700 px-4 py-3 bg-gray-50">Conta</h3>
          <div className="divide-y divide-gray-100">
            <Link href="/profile">
              <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <p className="text-sm text-gray-800">Perfil</p>
              </div>
            </Link>
            <button className="w-full px-4 py-3 hover:bg-gray-50 text-left">
              <p className="text-sm text-gray-800">Notificações</p>
            </button>
            <button className="w-full px-4 py-3 hover:bg-gray-50 text-left">
              <p className="text-sm text-gray-800">Privacidade</p>
            </button>
          </div>
        </div>

        {/* Sobre */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-sm font-medium text-gray-700 px-4 py-3 bg-gray-50">Sobre</h3>
          <div className="divide-y divide-gray-100">
            <button className="w-full px-4 py-3 hover:bg-gray-50 text-left">
              <p className="text-sm text-gray-800">Termos de uso</p>
            </button>
            <button className="w-full px-4 py-3 hover:bg-gray-50 text-left">
              <p className="text-sm text-gray-800">Política de privacidade</p>
            </button>
            <button className="w-full px-4 py-3 hover:bg-gray-50 text-left">
              <p className="text-sm text-gray-800">Ajuda e suporte</p>
            </button>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-500">Versão 1.0.0</p>
            </div>
          </div>
        </div>

        {/* Ad Space Placeholder */}
        <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
          <p className="text-xs text-gray-500">Espaço reservado para anúncio</p>
        </div>

        {/* Sair */}
        <button className="w-full bg-white rounded-xl shadow-sm px-4 py-3 text-red-600 font-medium hover:bg-red-50 transition-colors">
          Sair da conta
        </button>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
