'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Users } from 'lucide-react'
import Link from 'next/link'

interface GroupData {
  id: string
  name: string
  category: string
  participants: string[]
  transactions: any[]
  totalSpent: number
  balance: number
}

export default function GroupSettings() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    // Carregar grupo
    const savedGroups = localStorage.getItem('divideai_groups')
    if (savedGroups) {
      const groups = JSON.parse(savedGroups)
      const foundGroup = groups.find((g: GroupData) => g.id === params.id)
      
      if (foundGroup) {
        setGroup(foundGroup)
      } else {
        router.push('/')
      }
    }
  }, [params.id, router])

  const handleDelete = () => {
    const savedGroups = localStorage.getItem('divideai_groups')
    if (savedGroups) {
      const groups = JSON.parse(savedGroups)
      const updatedGroups = groups.filter((g: GroupData) => g.id !== params.id)
      localStorage.setItem('divideai_groups', JSON.stringify(updatedGroups))
      router.push('/')
    }
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
            <button className="text-[#5BC5A7] flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Configurações</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {/* Group Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-4 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">{group.name.substring(0, 2).toUpperCase()}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{group.name}</h2>
          <p className="text-gray-600">{group.participants.length} participantes</p>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Participantes</h3>
          </div>
          <div className="space-y-3">
            {group.participants.map((participant, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {participant.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{participant}</p>
                  {participant === 'Você' && (
                    <p className="text-sm text-gray-500">Você</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Estatísticas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total gasto</p>
              <p className="text-xl font-bold text-gray-800">R$ {group.totalSpent.toFixed(2)}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Transações</p>
              <p className="text-xl font-bold text-gray-800">{group.transactions?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-red-100">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Zona de Perigo</h3>
          <p className="text-sm text-gray-600 mb-4">
            Deletar este grupo removerá todas as transações e dados permanentemente.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            <Trash2 className="w-5 h-5" />
            Deletar Grupo
          </button>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Deletar grupo?</h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja deletar "{group.name}"? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-800 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
