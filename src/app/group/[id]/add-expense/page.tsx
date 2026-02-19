'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Participant {
  id: string
  name: string
  email?: string
}

interface Group {
  id: string
  name: string
  participantsList: Participant[]
  transactions: any[]
  totalSpent: number
  balance: number
}

export default function AddExpense() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string
  
  const [group, setGroup] = useState<Group | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payerId, setPayerId] = useState('')
  const [splitType, setSplitType] = useState<'equal' | 'manual'>('equal')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])

  useEffect(() => {
    // Carregar grupo
    const savedGroup = localStorage.getItem(`divideai_group_${groupId}`)
    if (savedGroup) {
      const parsedGroup = JSON.parse(savedGroup)
      setGroup(parsedGroup)
      setPayerId(parsedGroup.participantsList[0]?.id || '')
      setSelectedParticipants(parsedGroup.participantsList.map((p: Participant) => p.id))
    }
  }, [groupId])

  const toggleParticipant = (participantId: string) => {
    if (selectedParticipants.includes(participantId)) {
      setSelectedParticipants(selectedParticipants.filter(id => id !== participantId))
    } else {
      setSelectedParticipants([...selectedParticipants, participantId])
    }
  }

  const handleSave = () => {
    if (!amount || !description || !payerId || selectedParticipants.length === 0) {
      alert('Preencha todos os campos')
      return
    }

    const amountValue = parseFloat(amount)
    if (isNaN(amountValue) || amountValue <= 0) {
      alert('Valor inválido')
      return
    }

    if (!group) return

    // Criar transação
    const payer = group.participantsList.find(p => p.id === payerId)
    const newTransaction = {
      id: Date.now().toString(),
      description,
      amount: amountValue,
      payerId,
      payerName: payer?.name || 'Desconhecido',
      date: new Date().toISOString(),
      participants: selectedParticipants,
    }

    // Atualizar grupo
    const updatedGroup = {
      ...group,
      transactions: [...group.transactions, newTransaction],
      totalSpent: group.totalSpent + amountValue,
    }

    // Calcular novo saldo (simplificado - assumindo que "Você" é o primeiro participante)
    const splitAmount = amountValue / selectedParticipants.length
    if (payerId === group.participantsList[0].id) {
      // Você pagou
      updatedGroup.balance = group.balance + (amountValue - splitAmount)
    } else {
      // Outro pagou
      updatedGroup.balance = group.balance - splitAmount
    }

    // Salvar
    localStorage.setItem(`divideai_group_${groupId}`, JSON.stringify(updatedGroup))
    
    // Atualizar lista de grupos
    const savedGroups = localStorage.getItem('divideai_groups')
    if (savedGroups) {
      const groups = JSON.parse(savedGroups)
      const groupIndex = groups.findIndex((g: any) => g.id === groupId)
      if (groupIndex !== -1) {
        groups[groupIndex] = {
          ...groups[groupIndex],
          totalSpent: updatedGroup.totalSpent,
          balance: updatedGroup.balance,
        }
        localStorage.setItem('divideai_groups', JSON.stringify(groups))
      }
    }

    router.push(`/group/${groupId}`)
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href={`/group/${groupId}`}>
            <button className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Adicionar gasto</h1>
          <button
            onClick={handleSave}
            className="text-[#5BC5A7] font-medium hover:text-[#4AB396]"
          >
            Salvar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Valor */}
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Valor
          </label>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-gray-800">R$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              step="0.01"
              className="text-3xl font-bold text-gray-800 w-40 text-center border-b-2 border-[#5BC5A7] focus:outline-none"
            />
          </div>
        </div>

        {/* Descrição */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Churrasco, Mercado, Uber..."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5BC5A7] focus:border-transparent"
          />
        </div>

        {/* Quem pagou */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quem pagou?
          </label>
          <div className="space-y-2">
            {group.participantsList.map((participant) => (
              <button
                key={participant.id}
                onClick={() => setPayerId(participant.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  payerId === participant.id
                    ? 'border-[#5BC5A7] bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 bg-[#5BC5A7] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">{participant.name}</p>
                  {participant.email && (
                    <p className="text-xs text-gray-500">{participant.email}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Divisão */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Como dividir?
          </label>
          
          {/* Tipo de divisão */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSplitType('equal')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                splitType === 'equal'
                  ? 'bg-[#5BC5A7] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Igual para todos
            </button>
            <button
              onClick={() => setSplitType('manual')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                splitType === 'manual'
                  ? 'bg-[#5BC5A7] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manual
            </button>
          </div>

          {/* Participantes */}
          <div className="space-y-2">
            <p className="text-xs text-gray-600 mb-2">
              Selecione quem participou ({selectedParticipants.length} {selectedParticipants.length === 1 ? 'pessoa' : 'pessoas'})
            </p>
            {group.participantsList.map((participant) => {
              const isSelected = selectedParticipants.includes(participant.id)
              const splitAmount = amount && selectedParticipants.length > 0
                ? (parseFloat(amount) / selectedParticipants.length).toFixed(2)
                : '0.00'
              
              return (
                <button
                  key={participant.id}
                  onClick={() => toggleParticipant(participant.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-[#5BC5A7] bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-[#5BC5A7]' : 'bg-gray-300'
                    }`}>
                      <span className="text-white font-medium text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{participant.name}</p>
                  </div>
                  {isSelected && (
                    <p className="text-sm font-medium text-[#5BC5A7]">R$ {splitAmount}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Botão Salvar */}
        <button
          onClick={handleSave}
          className="w-full py-4 bg-[#5BC5A7] text-white rounded-xl font-medium hover:bg-[#4AB396] transition-colors shadow-sm"
        >
          Salvar gasto
        </button>
      </main>
    </div>
  )
}
