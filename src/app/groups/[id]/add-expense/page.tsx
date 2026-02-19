'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'

interface GroupData {
  id: string
  name: string
  participants: string[]
  transactions: any[]
  totalSpent: number
  balance: number
}

export default function AddExpense() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')
  const [payer, setPayer] = useState('Você')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [splitType, setSplitType] = useState<'equal' | 'manual'>('equal')

  useEffect(() => {
    // Carregar grupo
    const savedGroups = localStorage.getItem('divideai_groups')
    if (savedGroups) {
      const groups = JSON.parse(savedGroups)
      const foundGroup = groups.find((g: GroupData) => g.id === params.id)
      
      if (foundGroup) {
        setGroup(foundGroup)
        setSelectedParticipants(foundGroup.participants)
      } else {
        router.push('/')
      }
    }
  }, [params.id, router])

  const toggleParticipant = (participant: string) => {
    if (selectedParticipants.includes(participant)) {
      if (selectedParticipants.length > 1) {
        setSelectedParticipants(selectedParticipants.filter(p => p !== participant))
      }
    } else {
      setSelectedParticipants([...selectedParticipants, participant])
    }
  }

  const handleSave = () => {
    if (!description.trim() || !value || parseFloat(value) <= 0 || selectedParticipants.length === 0) {
      alert('Preencha todos os campos corretamente')
      return
    }

    // Carregar grupos
    const savedGroups = localStorage.getItem('divideai_groups')
    const groups = savedGroups ? JSON.parse(savedGroups) : []
    const groupIndex = groups.findIndex((g: GroupData) => g.id === params.id)

    if (groupIndex === -1) return

    // Criar transação
    const newTransaction = {
      id: Date.now().toString(),
      description: description.trim(),
      value: parseFloat(value),
      payer: payer,
      date: new Date().toISOString(),
      participants: selectedParticipants
    }

    // Atualizar grupo
    if (!groups[groupIndex].transactions) {
      groups[groupIndex].transactions = []
    }
    groups[groupIndex].transactions.push(newTransaction)
    
    // Atualizar total gasto
    groups[groupIndex].totalSpent += parseFloat(value)
    
    // Calcular saldo (simplificado)
    const amountPerPerson = parseFloat(value) / selectedParticipants.length
    if (payer === 'Você') {
      groups[groupIndex].balance += parseFloat(value) - amountPerPerson
    } else {
      groups[groupIndex].balance -= amountPerPerson
    }

    // Salvar
    localStorage.setItem('divideai_groups', JSON.stringify(groups))

    // Voltar para o grupo
    router.push(`/groups/${params.id}`)
  }

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
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href={`/groups/${params.id}`}>
            <button className="text-[#5BC5A7] font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Cancelar
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Adicionar Gasto</h1>
          <button 
            onClick={handleSave}
            className="text-[#5BC5A7] font-medium"
          >
            Salvar
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {/* Value */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-4 text-center">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Valor total
          </label>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-gray-400">R$</span>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="text-4xl font-bold text-gray-800 w-40 text-center focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Churrasco, Uber, Mercado..."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent"
          />
        </div>

        {/* Payer */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quem pagou?
          </label>
          <div className="space-y-2">
            {group.participants.map((participant) => (
              <button
                key={participant}
                onClick={() => setPayer(participant)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                  payer === participant
                    ? 'border-[#5BC5A7] bg-[#5BC5A7]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {participant.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-gray-800">{participant}</span>
                </div>
                {payer === participant && (
                  <Check className="w-5 h-5 text-[#5BC5A7]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Split Type */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Como dividir?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSplitType('equal')}
              className={`p-3 rounded-lg border-2 transition-all ${
                splitType === 'equal'
                  ? 'border-[#5BC5A7] bg-[#5BC5A7]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`font-medium ${splitType === 'equal' ? 'text-[#5BC5A7]' : 'text-gray-800'}`}>
                Igual para todos
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {value && selectedParticipants.length > 0
                  ? `R$ ${(parseFloat(value) / selectedParticipants.length).toFixed(2)} cada`
                  : 'Dividir igualmente'}
              </p>
            </button>
            <button
              onClick={() => setSplitType('manual')}
              className={`p-3 rounded-lg border-2 transition-all ${
                splitType === 'manual'
                  ? 'border-[#5BC5A7] bg-[#5BC5A7]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`font-medium ${splitType === 'manual' ? 'text-[#5BC5A7]' : 'text-gray-800'}`}>
                Manual
              </p>
              <p className="text-xs text-gray-600 mt-1">Valores diferentes</p>
            </button>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Dividir entre ({selectedParticipants.length})
          </label>
          <div className="space-y-2">
            {group.participants.map((participant) => (
              <button
                key={participant}
                onClick={() => toggleParticipant(participant)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                  selectedParticipants.includes(participant)
                    ? 'border-[#5BC5A7] bg-[#5BC5A7]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {participant.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-gray-800">{participant}</span>
                </div>
                {selectedParticipants.includes(participant) && (
                  <Check className="w-5 h-5 text-[#5BC5A7]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
