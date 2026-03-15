import type { Metadata } from 'next'
import StoreBadge from '@/components/marketing/store-badge'

export const metadata: Metadata = {
  title: 'iPhone | SplitMate',
  description: 'Instale o SplitMate no iPhone como Web App.',
}

function SafariStepPreview() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-red-300" />
        <span className="w-2 h-2 rounded-full bg-amber-300" />
        <span className="w-2 h-2 rounded-full bg-green-300" />
        <span className="ml-2">Safari</span>
      </div>
      <div className="p-4 grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <p className="text-xs font-semibold text-gray-700">1. Toque em compartilhar</p>
          <div className="mt-3 h-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl">↑</div>
              <p className="text-xs text-gray-500 mt-2">Botão Compartilhar</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <p className="text-xs font-semibold text-gray-700">2. Adicionar à Tela de Início</p>
          <div className="mt-3 h-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg">＋</div>
              <p className="text-xs text-gray-500 mt-2">Adicionar à Tela de Início</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function IOSPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dcfce7_0%,#f0fdf4_30%,#ffffff_75%)]">
      <main className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Usar o SplitMate no iPhone</h1>
        <p className="mt-2 text-gray-600">
          Enquanto a versão App Store não é publicada, você pode instalar como Web App em segundos.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Passo a passo</h2>
          <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal list-inside">
            <li>Abra o link do app no Safari.</li>
            <li>Toque no botão de compartilhar.</li>
            <li>Selecione “Adicionar à Tela de Início”.</li>
          </ol>
          <p className="mt-4 text-sm text-gray-600">
            Depois disso, o SplitMate abre como aplicativo no seu iPhone.
          </p>

          <div className="mt-5">
            <SafariStepPreview />
          </div>

          <div className="mt-5 flex gap-2 flex-wrap">
            <StoreBadge
              href="/login"
              platform="ios"
              subtitle="Abrir em nova aba"
              title="Apple · iPhone"
              newTab
              className="w-full sm:w-auto"
            />
          </div>
        </div>
      </main>
    </div>
  )
}
