'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildDebtBreakdown, type DebtBreakdownItem } from '@/lib/debt-breakdown'
import { fromCents } from '@/lib/money'
import UserAvatar from '@/components/user-avatar'

type DebtBreakdownModalProps = {
  open: boolean
  onClose: () => void
  debtorId: string
  creditorId: string
  groupId: string
  debtorName: string
  debtorAvatarKey?: string
  debtorIsPremium?: boolean
}

type TxRow = {
  id: string
  description?: string | null
  value: number
  payer_id: string
  splits?: Record<string, number> | null
  status?: string | null
  created_at?: string | null
}

export default function DebtBreakdownModal({
  open,
  onClose,
  debtorId,
  creditorId,
  groupId,
  debtorName,
  debtorAvatarKey,
  debtorIsPremium,
}: DebtBreakdownModalProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<DebtBreakdownItem[]>([])

  useEffect(() => {
    if (!open) return

    const load = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('transactions')
        .select('id,description,value,payer_id,splits,status,created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('debt-breakdown.transactions-load-error', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          groupId,
          creditorId,
          debtorId,
        })
        setItems([])
        setLoading(false)
        return
      }

      const txRows = ((data as TxRow[] | null) ?? []).map((row) => ({
        ...row,
        value: Number(row.value) || 0,
      }))

      const breakdown = buildDebtBreakdown(txRows, creditorId, debtorId)
      setItems(breakdown)
      setLoading(false)
    }

    load()
  }, [open, groupId, creditorId, debtorId])

  const totalCents = useMemo(() => items.reduce((acc, item) => acc + item.amountCents, 0), [items])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4 space-y-4 max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Detalhamento da divida</h3>
          <button
            type="button"
            onClick={onClose}
            className="tap-target pressable text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 bg-gray-50">
          <UserAvatar
            name={debtorName}
            avatarKey={debtorAvatarKey}
            isPremium={debtorIsPremium}
            className="w-9 h-9"
            textClassName="text-xs"
          />
          <p className="text-sm font-medium text-gray-800 truncate">{debtorName}</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum gasto pendente entre voces.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.transactionId} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-800">{item.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  R$ {fromCents(item.amountCents).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-base font-semibold text-gray-900">R$ {fromCents(totalCents).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
