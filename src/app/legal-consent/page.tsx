'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import LegalDocModal from '@/components/legal-doc-modal'
import { useAuth } from '@/context/AuthContext'
import { setLocalLegalConsent } from '@/lib/legal-consent'

export default function LegalConsentPage() {
  const { user } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)

  const handleContinue = async () => {
    setError('')

    if (!accepted) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.')
      return
    }

    if (!user?.id) {
      setError('Sessão inválida. Faça login novamente.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('legal-consent.update-error', {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        })
        setError('Nao foi possivel salvar o aceite. Tente novamente.')
        setLoading(false)
        return
      }

      setLocalLegalConsent(user.id, true)
      window.location.replace('/')
    } catch (error: any) {
      console.error('legal-consent.unhandled-error', error)
      setError(error?.message || 'Erro ao salvar aceite.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center px-4">
      <div className="surface-card w-full max-w-md p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-800">Aceite obrigatório</h1>
        <p className="text-sm text-gray-600">Para continuar usando o SplitMate, aceite os documentos legais.</p>

        <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-2">
          <button type="button" onClick={() => setLegalModal('terms')} className="text-sm text-[#5BC5A7] underline">
            Ver Termos de Uso
          </button>
          <button type="button" onClick={() => setLegalModal('privacy')} className="ml-3 text-sm text-[#5BC5A7] underline">
            Ver Política de Privacidade
          </button>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1"
            />
            <span>Li e aceito os Termos de Uso e a Política de Privacidade</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="w-full tap-target touch-friendly pressable bg-[#5BC5A7] text-white py-2.5 rounded-lg font-medium active:bg-[#4AB396] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'OK'}
        </button>
      </div>

      <LegalDocModal
        open={legalModal !== null}
        type={legalModal || 'terms'}
        onClose={() => setLegalModal(null)}
        onViewed={() => {}}
      />
    </div>
  )
}
