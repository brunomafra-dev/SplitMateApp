'use client'

import { ArrowLeft, Crown } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { usePremium } from '@/hooks/use-premium'
import BottomNav from '@/components/ui/bottom-nav'

export default function PremiumPage() {
  const { isPremium, isDev, devPremiumOverride, setDevPremium } = usePremium()
  const [showManageModal, setShowManageModal] = useState(false)
  const [showActivationInfoModal, setShowActivationInfoModal] = useState(false)

  const handleActivate = () => {
    setShowActivationInfoModal(true)
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] dark:bg-neutral-950 flex flex-col page-fade pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="bg-white dark:bg-neutral-900 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/settings">
            <button className="tap-target pressable text-gray-600 dark:text-gray-200 hover:text-gray-800" type="button" aria-label="Voltar">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">Premium</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="surface-card p-6 dark:bg-neutral-900 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="w-7 h-7 text-[#5BC5A7]" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">✨ SplitMate Premium</h2>
          </div>

          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200 mb-6">
            <li>✔ Remover anúncios</li>
            <li>✔ Modo escuro </li>
            <li>✔ Grupos ilimitados</li>
            <li>✔ Exportar relatórios </li>
          </ul>

          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">R$4,99 / mês</p>

          {!isPremium ? (
            <button
              type="button"
              onClick={handleActivate}
              className="w-full tap-target pressable bg-[#5BC5A7] text-white py-3 rounded-lg font-semibold hover:bg-[#4AB396] disabled:opacity-60"
            >
              Ativar Premium
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="w-full tap-target pressable bg-[#5BC5A7] text-white py-3 rounded-lg font-semibold hover:bg-[#4AB396]"
            >
              Gerenciar Plano
            </button>
          )}

          {isDev && (
            <div className="mt-3 rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Ambiente de desenvolvimento</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDevPremium(true)}
                  className="w-full tap-target pressable border border-[#5BC5A7] text-[#5BC5A7] py-2 rounded-lg text-sm font-medium hover:bg-[#5BC5A7]/10"
                >
                  Premium true
                </button>
                <button
                  type="button"
                  onClick={() => setDevPremium(false)}
                  className="w-full tap-target pressable border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-100"
                >
                  Premium false
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDevPremium(null)}
                className="mt-2 w-full tap-target pressable border border-gray-200 text-gray-600 py-2 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Limpar override (usar banco)
              </button>
              <p className="mt-2 text-[11px] text-gray-500">
                Override atual: {devPremiumOverride ?? 'null'}
              </p>
            </div>
          )}
        </div>
      </main>

      {showManageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-xl p-5">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Você já é Premium 🎉</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Gerenciamento de assinatura em breve.</p>
            <button
              type="button"
              onClick={() => setShowManageModal(false)}
              className="w-full tap-target pressable bg-[#5BC5A7] text-white py-2.5 rounded-lg font-medium hover:bg-[#4AB396]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showActivationInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-xl p-5">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">SplitMate Premium</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              A ativação da assinatura estará disponível quando o aplicativo for publicado na loja.
            </p>
            <button
              type="button"
              onClick={() => setShowActivationInfoModal(false)}
              className="w-full tap-target pressable bg-[#5BC5A7] text-white py-2.5 rounded-lg font-medium hover:bg-[#4AB396]"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
