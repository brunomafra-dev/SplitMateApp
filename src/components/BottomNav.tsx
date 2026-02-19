'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around items-center">
        <Link href="/" className={`flex flex-col items-center gap-1 ${isActive('/') && !pathname.includes('/activity') && !pathname.includes('/payments') && !pathname.includes('/settings') ? 'text-[#5BC5A7]' : 'text-gray-400 hover:text-[#5BC5A7]'}`}>
          <div className="w-6 h-6 flex items-center justify-center">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
          <span className={`text-xs ${isActive('/') && !pathname.includes('/activity') && !pathname.includes('/payments') && !pathname.includes('/settings') ? 'font-medium' : ''}`}>Grupos</span>
        </Link>
        <Link href="/activity" className={`flex flex-col items-center gap-1 ${isActive('/activity') ? 'text-[#5BC5A7]' : 'text-gray-400 hover:text-[#5BC5A7]'}`}>
          <div className="w-6 h-6 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className={`text-xs ${isActive('/activity') ? 'font-medium' : ''}`}>Atividade</span>
        </Link>
        <Link href="/payments" className={`flex flex-col items-center gap-1 ${isActive('/payments') ? 'text-[#5BC5A7]' : 'text-gray-400 hover:text-[#5BC5A7]'}`}>
          <div className="w-6 h-6 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className={`text-xs ${isActive('/payments') ? 'font-medium' : ''}`}>Pagamentos</span>
        </Link>
        <Link href="/settings" className={`flex flex-col items-center gap-1 ${isActive('/settings') ? 'text-[#5BC5A7]' : 'text-gray-400 hover:text-[#5BC5A7]'}`}>
          <div className="w-6 h-6 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className={`text-xs ${isActive('/settings') ? 'font-medium' : ''}`}>Conta</span>
        </Link>
      </div>
    </nav>
  )
}
