'use client'

import Link from 'next/link'
import {
  BarChart3,
  CheckCircle2,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import StoreBadge from '@/components/marketing/store-badge'

type HeroSnapshot = {
  title: string
  balance: string
  items: Array<{ label: string; value: string; tone: 'positive' | 'negative' }>
}

const heroSnapshots: HeroSnapshot[] = [
  {
    title: 'Viagem Floripa',
    balance: 'R$ 1.240,50',
    items: [
      { label: 'Hotel', value: 'Te devem R$ 320', tone: 'positive' },
      { label: 'Mercado', value: 'Voc deve R$ 90', tone: 'negative' },
      { label: 'Gasolina', value: 'Te devem R$ 210', tone: 'positive' },
    ],
  },
  {
    title: 'Repblica Centro',
    balance: 'R$ 782,20',
    items: [
      { label: 'Aluguel', value: 'Te devem R$ 520', tone: 'positive' },
      { label: 'Internet', value: 'Voc deve R$ 48', tone: 'negative' },
      { label: 'Energia', value: 'Te devem R$ 102', tone: 'positive' },
    ],
  },
  {
    title: 'Churrasco sbado',
    balance: 'R$ 436,80',
    items: [
      { label: 'Carnes', value: 'Te devem R$ 188', tone: 'positive' },
      { label: 'Bebidas', value: 'Voc deve R$ 36', tone: 'negative' },
      { label: 'Carvo', value: 'Te devem R$ 74', tone: 'positive' },
    ],
  },
]

const painItems = [
  'Conta do bar com amigos',
  'Mercado da casa',
  'Viagem em grupo',
  'Diviso de aluguel',
]

const steps = [
  {
    title: 'Criar grupo',
    text: 'Monte o grupo em segundos e convide as pessoas por link.',
  },
  {
    title: 'Adicionar gastos',
    text: 'Registre cada gasto com pagador e participantes do rateio.',
  },
  {
    title: 'Resolver pendncias',
    text: 'Veja o saldo por pessoa e marque pagamentos no fluxo real.',
  },
]

const featureCards = [
  {
    icon: Users,
    title: 'Fluxo colaborativo',
    text: 'Todos enxergam o mesmo estado do grupo com atualizao rpida.',
  },
  {
    icon: BarChart3,
    title: 'Viso financeira clara',
    text: 'A receber, a pagar e balano por pessoa sem confuso.',
  },
  {
    icon: ShieldCheck,
    title: 'Controle e segurana',
    text: 'Regras de acesso e permisses por usurio no banco de dados.',
  },
  {
    icon: Sparkles,
    title: 'Interface mobile-first',
    text: 'Pensado para uso no celular com navegao rpida e fluida.',
  },
]

const testimonials = [
  {
    name: 'Bruno M.',
    role: 'Usurio SplitMate',
    text: 'Antes era planilha e confuso. Agora o fechamento do grupo acontece no mesmo dia.',
  },
  {
    name: 'Larissa C.',
    role: 'Usuria SplitMate',
    text: 'A visualizao por pessoa deixou claro quem deve para quem, sem desgaste.',
  },
  {
    name: 'Carlos P.',
    role: 'Usurio SplitMate',
    text: 'A tela de pagamentos ficou objetiva e os lembretes ajudam muito no fluxo.',
  },
]

function ToneBadge({ text, tone }: { text: string; tone: 'positive' | 'negative' }) {
  const toneClass =
    tone === 'positive'
      ? 'text-[#5BC5A7] bg-emerald-50 border-emerald-200'
      : 'text-[#FF6B6B] bg-rose-50 border-rose-200'

  return <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${toneClass}`}>{text}</span>
}

export default function LandingPage() {
  const [activeSnapshot, setActiveSnapshot] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSnapshot((prev) => (prev + 1) % heroSnapshots.length)
    }, 3200)

    return () => window.clearInterval(timer)
  }, [])

  const currentSnapshot = useMemo(
    () => heroSnapshots[activeSnapshot] ?? heroSnapshots[0],
    [activeSnapshot]
  )

  return (
    <div className="min-h-screen text-gray-900 bg-[radial-gradient(circle_at_8%_6%,#d1fae5_0%,#ecfdf5_30%,#ffffff_74%)]">
      <header className="sticky top-0 z-30 border-b border-emerald-100/70 bg-white/82 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo/splitmate-icon.png" alt="SplitMate" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="font-semibold text-lg tracking-tight">SplitMate</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#como-funciona" className="hover:text-gray-900 transition-colors">Como funciona</a>
            <a href="#beneficios" className="hover:text-gray-900 transition-colors">Benefcios</a>
            <a href="#download" className="hover:text-gray-900 transition-colors">Download</a>
          </nav>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
            <Link href="/login" className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              Já tem conta? Entrar
            </Link>
            <Link href="/download" className="px-4 py-2 text-sm rounded-lg bg-[#5BC5A7] text-white hover:bg-[#4AB396] transition-colors shadow-sm">
              Baixar app
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 grid lg:grid-cols-2 gap-10 items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Organizao financeira sem frico
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-balance">
              Divida despesas em grupo com clareza e sem discusso.
            </h1>

            <p className="mt-4 text-lg text-gray-600 max-w-xl">
              Registre gastos, acompanhe saldos por pessoa e resolva pendncias com um fluxo objetivo no celular.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <StoreBadge
                href="/android"
                platform="android"
                subtitle="Disponvel para"
                title="Google Play  Android"
              />
              <StoreBadge
                href="/ios"
                platform="ios"
                subtitle="Use agora no"
                title="Apple  iPhone"
              />
            </div>

            <div className="mt-7 flex items-center gap-2 text-sm text-gray-600">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-semibold text-gray-800">4.9 de satisfao</span>
              <span></span>
              <span>Ideal para amigos, casais e repblicas</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 max-w-xl">
              <div className="rounded-lg border border-gray-200 bg-white/90 px-3 py-2">
                <p className="text-[11px] text-gray-500">Tempo de setup</p>
                <p className="text-sm font-semibold text-gray-900">~1 min</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/90 px-3 py-2">
                <p className="text-[11px] text-gray-500">Fluxo mobile</p>
                <p className="text-sm font-semibold text-gray-900">Otimizado</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/90 px-3 py-2">
                <p className="text-[11px] text-gray-500">Diviso</p>
                <p className="text-sm font-semibold text-gray-900">Em tempo real</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-8 -left-8 h-28 w-28 rounded-full bg-emerald-200/60 blur-2xl" />
            <div className="absolute -bottom-8 -right-4 h-32 w-32 rounded-full bg-teal-200/60 blur-2xl" />

            <div className="relative rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_10px_42px_rgba(16,185,129,0.16)] float-soft">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800">{currentSnapshot.title}</p>
                <span className="text-[11px] text-gray-500">Atualizando</span>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Saldo total</p>
                <p className="text-3xl font-bold text-[#5BC5A7] mt-1">{currentSnapshot.balance}</p>
              </div>

              <div className="mt-4 space-y-2">
                {currentSnapshot.items.map((item) => (
                  <div key={`${currentSnapshot.title}-${item.label}`} className="rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{item.label}</span>
                    <ToneBadge text={item.value} tone={item.tone} />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2">
                {heroSnapshots.map((_, index) => (
                  <span
                    key={`snapshot-dot-${index}`}
                    className={`h-2 rounded-full transition-all ${index === activeSnapshot ? 'w-6 bg-[#5BC5A7]' : 'w-2 bg-gray-300'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-semibold">Dores comuns, resolvidas em um s lugar</h2>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {painItems.map((item) => (
              <div key={item} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-medium">{item}</p>
                <p className="mt-1 text-sm text-gray-600">Sem planilha, sem mensagem perdida e sem dvida no fechamento.</p>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-semibold">Como funciona</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            {steps.map((item, index) => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="beneficios" className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-semibold">Por que o SplitMate</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {featureCards.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{item.text}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-semibold">Quem usa recomenda</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            {testimonials.map((item) => (
              <div key={item.name} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <Quote className="w-4 h-4 text-emerald-500" />
                <p className="text-sm text-gray-700 mt-2">{item.text}</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.role}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="download" className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <h2 className="text-2xl font-semibold">Pronto para dividir contas sem dor de cabea?</h2>
                <p className="mt-1 text-sm text-gray-700">Escolha sua plataforma e comece hoje.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <StoreBadge
                  href="/android"
                  platform="android"
                  subtitle="Baixe para"
                  title="Google Play  Android"
                />
                <StoreBadge
                  href="/ios"
                  platform="ios"
                  subtitle="Use no"
                  title="Apple  iPhone"
                />
              </div>
            </div>

            <div className="mt-5 grid sm:grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Fluxo manual de pagamento claro
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Controle por grupo e por pessoa
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Interface otimizada para celular
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-gray-600">
          <p> {new Date().getFullYear()} SplitMate. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-900">Poltica de Privacidade</Link>
            <Link href="/terms" className="hover:text-gray-900">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}








