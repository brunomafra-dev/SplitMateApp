'use client'

import { ArrowLeft, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/ui/bottom-nav'

interface Payment {
  id: string
  description: string
  amount: number
  from: string
  to: string
  status: 'paid' | 'pending'
  date: string
  groupName: string
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')

  useEffect(() => {
    // ✅ Sem mock e sem localStorage
    // Se você já tinha mock salvo no navegador, limpa pra sumir de vez:
    try {
      localStorage.removeItem('divideai_payments')
    } catch {}
    setPayments([])
  }, [])

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true
    return payment.status === filter
  })

  const totalPaid = payments
    .filter(p => p.status === 'paid' && p.from === 'Você')
    .reduce((acc, p) => acc + p.amount, 0)

  const totalReceived = payments
    .filter(p => p.status === 'paid' && p.to === 'Você')
    .reduce((acc, p) => acc + p.amount, 0)

  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((acc, p) => acc + p.amount, 0)

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
          <h1 className="text-lg font-semibold text-gray-800">Pagamentos</h1>
          <div className="w-6"></div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <TrendingUp className="w-5 h-5 text-[#5BC5A7] mx-auto mb-2" />
              <p className="text-xs text-gray-600 mb-1">Recebido</p>
              <p className="text-lg font-bold text-[#5BC5A7]">R$ {totalReceived.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <TrendingDown className="w-5 h-5 text-[#FF6B6B] mx-auto mb-2" />
              <p className="text-xs text-gray-600 mb-1">Pago</p>
              <p className="text-lg font-bold text-[#FF6B6B]">R$ {totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 text-orange-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 mb-1">Pendente</p>
              <p className="text-lg font-bold text-orange-500">R$ {totalPending.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-[#5BC5A7] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'paid'
                  ? 'bg-[#5BC5A7] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pagos
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-[#5BC5A7] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pendentes
            </button>
          </div>
        </div>
      </div>

      {/* Payments List */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum pagamento</h3>
            <p className="text-gray-600">
              {filter === 'all'
                ? 'Você ainda não tem pagamentos registrados'
                : filter === 'paid'
                ? 'Nenhum pagamento concluído'
                : 'Nenhum pagamento pendente'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-medium text-gray-800">
                        {payment.description}
                      </h3>
                      {payment.status === 'paid' ? (
                        <CheckCircle className="w-4 h-4 text-[#5BC5A7]" />
                      ) : (
                        <Clock className="w-4 h-4 text-orange-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {payment.from} → {payment.to}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{payment.groupName}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-semibold text-gray-800">
                      R$ {payment.amount.toFixed(2)}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        payment.status === 'paid'
                          ? 'bg-green-50 text-[#5BC5A7]'
                          : 'bg-orange-50 text-orange-500'
                      }`}
                    >
                      {payment.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>{new Date(payment.date).toLocaleDateString('pt-BR')}</span>
                  <span>{new Date(payment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Ad Space Placeholder */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
          <p className="text-xs text-gray-500">Espaço reservado para anúncio</p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
