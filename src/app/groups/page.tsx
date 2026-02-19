'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Participant { id: string; name: string }
interface Group { id: string; name: string; participants?: Participant[] }
interface Transaction {
  id: string; group_id: string; value: number; payer_id: string; participants: string[]; splits: Record<string, number>; description: string; created_at?: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: g } = await supabase.from('groups').select('*')
    const { data: t } = await supabase.from('transactions').select('*')
    setGroups(g || [])
    setTransactions((t || []).map(tx => ({ ...tx, value: Number(tx.value) })))
    setLoading(false)
  }

  // Calcula total do grupo e saldo do "você" (first participant)
  function groupTotals(group: Group) {
    const groupTx = transactions.filter(tx => tx.group_id === group.id)
    const totalSpent = groupTx.reduce((s, tx) => s + (Number(tx.value) || 0), 0)

    const me = group.participants && group.participants[0] ? group.participants[0].id : null
    let myBalance = 0
    if (me) {
      groupTx.forEach(tx => {
        if (tx.payer_id === me) myBalance += Number(tx.value) || 0
        const share = tx.splits && tx.splits[me] ? Number(tx.splits[me]) : 0
        myBalance -= share
      })
    }
    return { totalSpent, myBalance }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Grupos</h1>
          <Link href="/home" className="text-sm text-gray-600">Voltar</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? <p className="text-center text-gray-500">Carregando...</p> : (
          <>
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum grupo ainda.</p>
                <Link href="/home" className="mt-4 inline-block bg-[#5BC5A7] text-white px-6 py-2 rounded">Criar grupo</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(g => {
                  const { totalSpent, myBalance } = groupTotals(g)
                  return (
                    <Link key={g.id} href={`/group/${g.id}`}>
                      <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center cursor-pointer border border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-800">{g.name}</h3>
                          <p className="text-xs text-gray-500">{g.participants?.length || 0} pessoas • R$ {totalSpent.toFixed(2)} gasto</p>
                        </div>

                        <div className="text-right">
                          {myBalance === 0 ? (
                            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">zerado</span>
                          ) : myBalance > 0 ? (
                            <div>
                              <p className="text-xs text-gray-600">te devem</p>
                              <p className="font-semibold text-[#5BC5A7]">R$ {myBalance.toFixed(2)}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-600">você deve</p>
                              <p className="font-semibold text-[#FF6B6B]">R$ {Math.abs(myBalance).toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Link href="/home">
        <button className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#5BC5A7] flex items-center justify-center shadow-lg text-white">
          <Plus className="w-6 h-6" />
        </button>
      </Link>
    </div>
  )
}

