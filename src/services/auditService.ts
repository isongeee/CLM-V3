import { supabase } from '../lib/supabaseClient'
import type { UUID } from '../types'

export type AuditLogRow = {
  id: UUID
  company_id: UUID
  actor_email: string | null
  entity_type: string
  entity_id: UUID | null
  action: string
  created_at: string
  new_value: unknown | null
  old_value: unknown | null
}

export const auditService = {
  async listForContract(companyId: UUID, contractId: UUID, limit = 50): Promise<AuditLogRow[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id,company_id,actor_email,entity_type,entity_id,action,created_at,new_value,old_value')
      .eq('company_id', companyId)
      .eq('entity_type', 'contract')
      .eq('entity_id', contractId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as AuditLogRow[]
  }
}

