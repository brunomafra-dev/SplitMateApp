'use client'

import Link from 'next/link'
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react'
import BottomNav from '@/components/ui/bottom-nav'

const supportEmail = 'chefbrunomafra@gmail.com'
const whatsappNumber = '5582991138130'
const whatsappLabel = '(82) 991138130'

export default function SupportPage() {
  const subject = encodeURIComponent('Suporte SplitMate')
  const body = encodeURIComponent('Ola, preciso de ajuda com o app SplitMate.')
  const mailto = `mailto:${supportEmail}?subject=${subject}&body=${body}`
  const whatsapp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Ola, preciso de ajuda com o SplitMate.')}`

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-[calc(6rem+env(safe-area-inset-bottom))] page-fade">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/settings">
            <button type="button" className="tap-target pressable text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="section-title">Ajuda e suporte</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        <a href={mailto} className="surface-card surface-card-hover pressable p-4 flex items-center justify-between" target="_blank" rel="noreferrer">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#5BC5A7]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Contato por e-mail</p>
              <p className="text-xs text-gray-500">{supportEmail}</p>
            </div>
          </div>
          <span className="text-xs text-gray-500">Abrir</span>
        </a>

        <a href={whatsapp} className="surface-card surface-card-hover pressable p-4 flex items-center justify-between" target="_blank" rel="noreferrer">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-[#5BC5A7]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Contato por WhatsApp</p>
              <p className="text-xs text-gray-500">{whatsappLabel}</p>
            </div>
          </div>
          <span className="text-xs text-gray-500">Abrir</span>
        </a>
      </main>

      <BottomNav />
    </div>
  )
}
