'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, User } from 'lucide-react'
import Link from 'next/link'

interface Transaction {
  id: string
  description: string
  value: number
  payer: string
  date: string
  participants: string[]
}

interface GroupData {
  id: string
  name: string
  avatar: string
  totalSpent: number
  balance: number
  participants: string[]
  transactions: Transaction[]
}

export default function GroupPage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<GroupData | null>(null)

  useEffect(() => {
    // Carregar grupo do localStorage
    const savedGroups = localStorage.getItem('divideai_groups')
    if (savedGroups) {
      const groups = JSON.parse(savedGroups)
      const foundGroup = groups.find((g: GroupData) => g.id === params.id)
      
      if (foundGroup) {
        // Garantir que transactions existe
        if (!foundGroup.transactions) {
          foundGroup.transactions = []
        }
        setGroup(foundGroup)
      } else {
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }, [params.id, router])

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#5BC5A7] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-[#5BC5A7] flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">{group.name}</h1>
          <Link href={`/groups/${group.id}/settings`}>
            <button className="text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </Link>
        </div>
      </header>

      {/* Balance Card */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-2xl p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm opacity-90 mb-1">Total gasto</p>
                <p className="text-3xl font-bold">R$ {group.totalSpent.toFixed(2)}</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold">{group.avatar}</span>
              </div>
            </div>
            
            <div className="h-px bg-white/20 my-4"></div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-90 mb-1">Seu saldo</p>
                {group.balance === 0 ? (
                  <p className="text-xl font-bold">Zerado ✓</p>
                ) : group.balance > 0 ? (
                  <p className="text-xl font-bold">Te devem R$ {group.balance.toFixed(2)}</p>
                ) : (
                  <p className="text-xl font-bold">Você deve R$ {Math.abs(group.balance).toFixed(2)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <main className="max-w-2xl mx-auto p-4">
        {group.transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Plus className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum gasto ainda</h3>
            <p className="text-gray-600 mb-6">Adicione o primeiro gasto do grupo</p>
            <Link href={`/groups/${group.id}/add-expense`}>
              <button className="bg-[#5BC5A7] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#4AB396] transition-colors">
                Adicionar gasto
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Gastos</h2>
              <span className="text-sm text-gray-500">{group.transactions.length} {group.transactions.length === 1 ? 'gasto' : 'gastos'}</span>
            </div>
            <div className="space-y-3">
              {group.transactions.map((transaction) => (
                <div key={transaction.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">🧾</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-800 mb-1">{transaction.description}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {transaction.payer} pagou R$ {transaction.value.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.date).toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-gray-600 mb-1">Você {transaction.payer === 'Você' ? 'pagou' : 'deve'}</p>
                      <p className={`text-base font-bold ${transaction.payer === 'Você' ? 'text-[#5BC5A7]' : 'text-[#FF6B6B]'}`}>
                        R$ {(transaction.value / transaction.participants.length).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Floating Action Button */}
      <Link href={`/groups/${group.id}/add-expense`}>
        <button className="fixed bottom-6 right-6 w-16 h-16 bg-[#5BC5A7] rounded-full flex items-center justify-center shadow-lg hover:bg-[#4AB396] transition-all hover:scale-110">
          <Plus className="w-7 h-7 text-white" />
        </button>
      </Link>
    </div>
  )
}
