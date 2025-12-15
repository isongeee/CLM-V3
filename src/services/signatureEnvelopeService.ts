import { supabase } from '../lib/supabaseClient'
import type { UUID } from '../types'

export const signatureEnvelopeService = {
  async createInternalEnvelope(companyId: UUID, contractId: UUID, recipients: { email: string }[]) {
    const { data, error } = await supabase.functions.invoke('create-envelope', {
      body: { company_id: companyId, contract_id: contractId, recipients }
    })
    if (error) throw error
    return data as { ok: true; envelope_id: UUID }
  }
}

