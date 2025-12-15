import { supabase } from '../lib/supabaseClient'
import type { PermissionKey, UUID } from '../types'

export const rbacService = {
  async listRolePermissionKeys(companyId: UUID, roleId: UUID): Promise<PermissionKey[]> {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('company_id', companyId)
      .eq('role_id', roleId)

    if (error) throw error
    return (data ?? []).map((r) => r.permission_key) as PermissionKey[]
  }
}

