'use client'

import UserAvatar from '@/components/user-avatar'
import { fromCents } from '@/lib/money'
import type { SimplifiedPayment } from '@/lib/debt-simplifier'

type SettlementProfile = {
  userId: string
  name: string
  avatarKey?: string
  isPremium?: boolean
}

type SuggestedSettlementsProps = {
  suggestions: SimplifiedPayment[]
  profiles: SettlementProfile[]
  onRegister?: () => Promise<void> | void
  registering?: boolean
}

function profileByUserId(profiles: SettlementProfile[], userId: string) {
  return profiles.find((profile) => String(profile.userId) === String(userId))
}

export default function SuggestedSettlements({
  suggestions,
  profiles,
  onRegister,
  registering = false,
}: SuggestedSettlementsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="surface-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="section-title">Sugestao de liquidacao</h3>
            {onRegister && (
              <button
                type="button"
                onClick={() => onRegister()}
                disabled={registering}
                className="tap-target pressable px-3 py-2 text-sm rounded-lg bg-[#5BC5A7] text-white hover:bg-[#4AB396] disabled:opacity-60"
              >
                {registering ? 'Registrando...' : 'Registrar pagamentos'}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {suggestions.map((suggestion, index) => {
              const fromProfile = profileByUserId(profiles, suggestion.fromUserId)
              const toProfile = profileByUserId(profiles, suggestion.toUserId)
              const fromName = fromProfile?.name || 'Participante'
              const toName = toProfile?.name || 'Participante'

              return (
                <div key={`${suggestion.fromUserId}-${suggestion.toUserId}-${suggestion.amountCents}-${index}`} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={fromName}
                        avatarKey={fromProfile?.avatarKey}
                        isPremium={fromProfile?.isPremium}
                        className="w-8 h-8"
                        textClassName="text-xs"
                      />
                      <span className="text-sm font-medium text-gray-800 truncate">{fromName}</span>
                    </div>

                    <span className="text-sm text-gray-500">{'->'}</span>

                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={toName}
                        avatarKey={toProfile?.avatarKey}
                        isPremium={toProfile?.isPremium}
                        className="w-8 h-8"
                        textClassName="text-xs"
                      />
                      <span className="text-sm font-medium text-gray-800 truncate">{toName}</span>
                    </div>

                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      R$ {fromCents(suggestion.amountCents).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
