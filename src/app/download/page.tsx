import type { Metadata } from 'next'
import Link from 'next/link'
import StoreBadge from '@/components/marketing/store-badge'

export const metadata: Metadata = {
  title: 'Download | SplitMate',
  description: 'Baixe o SplitMate para Android ou use no iPhone.',
}

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dcfce7_0%,#f0fdf4_32%,#ffffff_74%)]">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Baixe o SplitMate</h1>
        <p className="mt-2 text-gray-600">Escolha sua plataforma e comece agora.</p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <StoreBadge
              href="/android"
              platform="android"
              subtitle="Disponível para"
              title="Google Play · Android"
            />
            <StoreBadge
              href="/ios"
              platform="ios"
              subtitle="Use agora no"
              title="Apple · iPhone"
            />
          </div>

          <p className="mt-5 text-sm text-gray-600">
            Android via APK oficial. iPhone via Web App com instalação pela tela inicial.
          </p>
        </div>

        <div className="mt-4">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Voltar para a página inicial
          </Link>
        </div>
      </main>
    </div>
  )
}


