'use client'

import { ArrowLeft, UserPlus, Search } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function Friends() {
  const [searchTerm, setSearchTerm] = useState('')

  const friends = [
    { id: '1', name: 'João Silva', email: 'joao@email.com', balance: 150 },
    { id: '2', name: 'Maria Santos', email: 'maria@email.com', balance: -80 },
    { id: '3', name: 'Pedro Costa', email: 'pedro@email.com', balance: 0 },
    { id: '4', name: 'Ana Oliveira', email: 'ana@email.com', balance: 200 },
  ]

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <h1 className="text-lg font-semibold text-gray-800">Amigos</h1>
          <button className="text-[#5BC5A7] hover:text-[#4AB396]">
            <UserPlus className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar amigos..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent"
            />
          </div>
        </div>

        {/* Friends List */}
        <div className="space-y-3">
          {filteredFriends.map((friend) => (
            <div key={friend.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#5BC5A7] rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {friend.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{friend.name}</p>
                    <p className="text-xs text-gray-500">{friend.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  {friend.balance === 0 ? (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      zerado
                    </span>
                  ) : friend.balance > 0 ? (
                    <div>
                      <p className="text-xs text-gray-600">te deve</p>
                      <p className="text-sm font-semibold text-[#5BC5A7]">
                        R$ {friend.balance.toFixed(2)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-600">você deve</p>
                      <p className="text-sm font-semibold text-[#FF6B6B]">
                        R$ {Math.abs(friend.balance).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredFriends.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">Nenhum amigo encontrado</p>
          </div>
        )}
      </main>
    </div>
  )
}
