'use client'

import { ArrowLeft, Crown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/ui/bottom-nav'
import packageJson from '../../../package.json'
import { useTheme } from 'next-themes'
import { usePremium } from '@/hooks/use-premium'

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const { isPremium } = usePremium()
  const appVersion = useMemo(() => String((packageJson as { version?: string }).version || '0.0.0'), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setLoading(false)
    }

    load()
  }, [router])

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      console.error('settings.delete-account-error', error)
      setDeletingAccount(false)
      return
    }
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isDark = mounted && resolvedTheme === 'dark'

  const handleThemeToggle = () => {
    if (!isPremium) return
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] dark:bg-neutral-950 pb-[calc(6rem+env(safe-area-inset-bottom))] page-fade">
      <header className="bg-white dark:bg-neutral-900 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="tap-target pressable text-gray-600 hover:text-gray-800" type="button">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">Conta</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center gap-3 mb-3">
            <Crown className="w-8 h-8" />
            <h2 className="text-2xl font-bold">SplitMate Premium</h2>
          </div>
          <p className="text-white/90 mb-4">Plano atual: {isPremium ? 'Premium' : 'Free'}</p>
          <Link href="/premium">
            <button className="w-full tap-target pressable bg-white text-[#5BC5A7] py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors" type="button">
              {isPremium ? 'Gerenciar Plano' : 'Seja Premium'}
            </button>
          </Link>
        </div>

        <div className="surface-card overflow-hidden dark:bg-neutral-900 dark:border-neutral-800">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 px-4 py-3 bg-gray-50 dark:bg-neutral-800">Conta</h3>
          <div className="divide-y divide-gray-100 dark:divide-neutral-800">
            <Link href="/profile" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-800 dark:text-gray-100">Perfil</span>
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </Link>
            <button
              type="button"
              onClick={handleThemeToggle}
              disabled={!isPremium}
              title={!isPremium ? 'Recurso premium' : 'Alternar tema'}
              aria-label={!isPremium ? 'Recurso premium' : 'Alternar tema'}
              className={`w-full tap-target px-4 py-3 flex items-center justify-between transition-colors text-left ${isPremium ? 'hover:bg-gray-50 dark:hover:bg-neutral-800' : 'opacity-60 cursor-not-allowed'}`}
            >
              <span className="text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Dark Mode
              </span>
              <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark && isPremium ? 'bg-[#5BC5A7]' : 'bg-gray-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isDark && isPremium ? 'translate-x-5' : 'translate-x-1'}`} />
              </span>
            </button>
            <Link href="/settings/notifications" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-800 dark:text-gray-100">Notificações</span>
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </Link>
            <Link href="/settings/privacy" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-800 dark:text-gray-100">Privacidade</span>
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </Link>
          </div>
        </div>

        <div className="surface-card overflow-hidden dark:bg-neutral-900 dark:border-neutral-800">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 px-4 py-3 bg-gray-50 dark:bg-neutral-800">Sobre</h3>
          <div className="divide-y divide-gray-100 dark:divide-neutral-800">
            <Link href="/settings/terms" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-800 dark:text-gray-100">Termos de uso</span>
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </Link>
            <Link href="/settings/privacy-policy" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-800 dark:text-gray-100">Política de privacidade</span>
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </Link>
            <Link href="/settings/support" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-800 dark:text-gray-100">Ajuda e suporte</span>
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </Link>
            <Link href="/settings/about" className="tap-target px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
              <span className="text-sm text-gray-500 dark:text-gray-300">Versão {appVersion}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-400" />
            </Link>
          </div>
        </div>

        {!loading && !isPremium && (
          <div className="bg-gray-100 dark:bg-neutral-900 rounded-xl p-4 text-center border-2 border-dashed border-gray-300 dark:border-neutral-700">
            <p className="text-xs text-gray-500 dark:text-gray-300">Espaco de anuncio ativo no plano Free</p>
          </div>
        )}

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full tap-target touch-friendly pressable bg-white dark:bg-neutral-900 rounded-xl shadow-sm px-4 py-3 text-red-700 font-medium active:bg-red-50 dark:active:bg-red-950/40 transition-colors flex items-center justify-center"
          type="button"
        >
          Excluir conta
        </button>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Excluir conta</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Toda sua conta será removida permanentemente. Isso inclui seus grupos, registros e informações associadas.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
                className="flex-1 tap-target touch-friendly pressable border border-gray-300 rounded-lg py-2 text-gray-700 dark:text-gray-200 active:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 tap-target touch-friendly pressable bg-red-600 text-white rounded-lg py-2 font-medium active:bg-red-700 disabled:opacity-60"
              >
                {deletingAccount ? 'Excluindo...' : 'Excluir conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

