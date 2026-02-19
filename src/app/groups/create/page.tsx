'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Home, Plane, Users, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'

const categories = [
  { id: 'home', label: 'Casa', icon: Home },
  { id: 'trip', label: 'Viagem', icon: Plane },
  { id: 'friends', label: 'Amigos', icon: Users },
  { id: 'other', label: 'Outro', icon: MoreHorizontal },
]

export default function CreateGroup() {
  const router = useRouter()
  const [groupName, setGroupName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('other')
  const [participants, setParticipants] = useState<string[]>(['Você'])
  const [newParticipant, setNewParticipant] = useState('')

  const addParticipant = () => {
    if (newParticipant.trim() && !participants.includes(newParticipant.trim())) {
      setParticipants([...participants, newParticipant.trim()])
      setNewParticipant('')
    }
  }

  const removeParticipant = (name: string) => {
    if (name !== 'Você') {
      setParticipants(participants.filter(p => p !== name))
    }
  }

  const handleCreate = () => {
    if (!groupName.trim() || participants.length < 2) {
      alert('Adicione um nome e pelo menos 2 participantes')
      return
    }

    // Carregar grupos existentes
    const savedGroups = localStorage.getItem('divideai_groups')
    const groups = savedGroups ? JSON.parse(savedGroups) : []

    // Criar novo grupo
    const newGroup = {
      id: Date.now().toString(),
      name: groupName,
      category: selectedCategory,
      totalSpent: 0,
      balance: 0,
      avatar: groupName.substring(0, 2).toUpperCase(),
      participants: participants,
      transactions: []
    }

    groups.push(newGroup)
    localStorage.setItem('divideai_groups', JSON.stringify(groups))

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <button className="text-[#5BC5A7] font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Cancelar
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Novo Grupo</h1>
          <button 
            onClick={handleCreate}
            className="text-[#5BC5A7] font-medium"
          >
            Criar
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {/* Group Name */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome do grupo
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ex: Viagem para Praia"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent"
          />
        </div>

        {/* Category */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Categoria
          </label>
          <div className="grid grid-cols-4 gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedCategory === cat.id
                      ? 'border-[#5BC5A7] bg-[#5BC5A7]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${selectedCategory === cat.id ? 'text-[#5BC5A7]' : 'text-gray-600'}`} />
                  <span className={`text-xs font-medium ${selectedCategory === cat.id ? 'text-[#5BC5A7]' : 'text-gray-600'}`}>
                    {cat.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Participantes ({participants.length})
          </label>
          
          {/* Add Participant */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newParticipant}
              onChange={(e) => setNewParticipant(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
              placeholder="Nome do participante"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent"
            />
            <button
              onClick={addParticipant}
              className="px-4 py-2 bg-[#5BC5A7] text-white rounded-lg hover:bg-[#4AB396] transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Participants List */}
          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {participant.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-gray-800">{participant}</span>
                </div>
                {participant !== 'Você' && (
                  <button
                    onClick={() => removeParticipant(participant)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {participants.length < 2 && (
            <p className="text-sm text-amber-600 mt-3 flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              Adicione pelo menos mais 1 participante
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
