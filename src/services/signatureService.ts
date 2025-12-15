import { supabase } from '../lib/supabaseClient'
import type { UUID } from '../types'

export type SignatureTask = {
  recipient_id: UUID
  envelope_id: UUID
  recipient_status: string
  envelope_status: string
  contract_id: UUID
  created_at: string
}

export const signatureService = {
  async listMyTasks(companyId: UUID): Promise<SignatureTask[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!userData.user?.id) return []

    const { data, error } = await supabase
      .from('signature_recipients')
      .select('id,envelope_id,status,signature_envelopes!inner(id,status,contract_id,created_at)')
      .eq('company_id', companyId)
      .eq('user_id', userData.user.id)
      .neq('status', 'signed')
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = (data ?? []) as any[]
    return rows.map((r) => ({
      recipient_id: r.id,
      envelope_id: r.envelope_id,
      recipient_status: r.status,
      envelope_status: r.signature_envelopes.status,
      contract_id: r.signature_envelopes.contract_id,
      created_at: r.signature_envelopes.created_at
    }))
  },

  async sign(companyId: UUID, envelopeId: UUID) {
    const { data, error } = await supabase.functions.invoke('sign-envelope', {
      body: { company_id: companyId, envelope_id: envelopeId }
    })
    if (error) throw error
    return data
  }
}

