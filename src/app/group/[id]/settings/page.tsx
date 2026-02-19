'use client'

import { ArrowLeft, Trash2, Users } from 'lucide-react'
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
  category: string
  participantsList: Participant[]
  simplifyDebts?: boolean
}

export default function GroupSettings() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string
  
  const [group, setGroup] = useState<Group | null>(null)
  const [simplifyDebts, setSimplifyDebts] = useState(true)

  useEffect(() => {
    const savedGroup = localStorage.getItem(`divideai_group_${groupId}`)
    if (savedGroup) {
      const parsedGroup = JSON.parse(savedGroup)
      setGroup(parsedGroup)
      setSimplifyDebts(parsedGroup.simplifyDebts ?? true)
    }
  }, [groupId])

  const handleToggleSimplify = () => {
    if (!group) return
    
    const newValue = !simplifyDebts
    setSimplifyDebts(newValue)
    
    const updatedGroup = { ...group, simplifyDebts: newValue }
    localStorage.setItem(`divideai_group_${groupId}`, JSON.stringify(updatedGroup))
  }

  const handleDeleteGroup = () => {
    if (confirm('Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.')) {
      // Remover grupo específico
      localStorage.removeItem(`divideai_group_${groupId}`)
      
      // Remover da lista de grupos
      const savedGroups = localStorage.getItem('divideai_groups')
      if (savedGroups) {
        const groups = JSON.parse(savedGroups)
        const filteredGroups = groups.filter((g: any) => g.id !== groupId)
        localStorage.setItem('divideai_groups', JSON.stringify(filteredGroups))
      }
      
      router.push('/')
    }
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  const categories = {
    apartment: { label: 'Apartamento', icon: '🏢' },
    house: { label: 'Casa', icon: '🏠' },
    trip: { label: 'Viagem', icon: '✈️' },
    other: { label: 'Outro', icon: '📋' },
  }

  const currentCategory = categories[group.category as keyof typeof categories] || categories.other

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
          <h1 className="text-lg font-semibold text-gray-800">Configurações</h1>
          <div className="w-6"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Nome e Categoria */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Nome do grupo
            </label>
            <p className="text-lg font-semibold text-gray-800">{group.name}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Categoria
            </label>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentCategory.icon}</span>
              <span className="text-base text-gray-800">{currentCategory.label}</span>
            </div>
          </div>
        </div>

        {/* Participantes */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participantes
            </label>
            <span className="text-sm text-gray-600">{group.participantsList.length} {group.participantsList.length === 1 ? 'pessoa' : 'pessoas'}</span>
          </div>
          
          <div className="space-y-2">
            {group.participantsList.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-10 h-10 bg-[#5BC5A7] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{participant.name}</p>
                  {participant.email && (
                    <p className="text-xs text-gray-500">{participant.email}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configurações Avançadas */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Configurações avançadas</h3>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-800">Simplificar dívidas</p>
              <p className="text-xs text-gray-500 mt-1">
                Reduz o número de transações necessárias
              </p>
            </div>
            <button
              onClick={handleToggleSimplify}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                simplifyDebts ? 'bg-[#5BC5A7]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  simplifyDebts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Zona de Perigo */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-red-100">
          <h3 className="text-sm font-medium text-red-600 mb-3">Zona de perigo</h3>
          
          <button
            onClick={handleDeleteGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-medium">Excluir grupo</span>
          </button>
          
          <p className="text-xs text-gray-500 text-center mt-2">
            Esta ação não pode ser desfeita
          </p>
        </div>
      </main>
    </div>
  )
}
