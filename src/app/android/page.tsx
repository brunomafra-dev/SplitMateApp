import type { Metadata } from 'next'
import StoreBadge from '@/components/marketing/store-badge'

export const metadata: Metadata = {
  title: 'Android | SplitMate',
  description: 'Baixe o APK do SplitMate para Android.',
}

export default function AndroidPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dcfce7_0%,#f0fdf4_32%,#ffffff_74%)]">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900">SplitMate para Android</h1>
        <p className="mt-2 text-gray-600">
          Baixe a versão atual em APK. Em breve, também disponível na Play Store.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <StoreBadge
            href="/apk/SplitMate.apk"
            platform="android"
            subtitle="Baixar agora"
            title="Google Play · Android"
            className="w-full sm:w-auto"
          />
          <p className="mt-4 text-sm text-gray-600">
            Arquivo oficial: <span className="font-medium text-gray-800">SplitMate.apk</span>
          </p>
        </div>
      </main>
    </div>
  )
}
