import { supabase } from '../lib/supabaseClient'
import type { CompanySummary } from '../types'

type Row = {
  company_id: string
  user_id: string
  role_id: string | null
  is_admin: boolean
  is_active: boolean
  companies: {
    id: string
    name: string
    invite_code: string | null
    is_onboarding_completed: boolean | null
  } | null
}

export const companyService = {
  async listMyCompanies(): Promise<CompanySummary[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!userData.user?.id) return []

    const { data, error } = await supabase
      .from('company_users')
      .select('company_id,user_id,role_id,is_admin,is_active,companies(id,name,invite_code,is_onboarding_completed)')
      .eq('is_active', true)
      .eq('user_id', userData.user.id)
      .order('joined_at', { ascending: false })

    if (error) throw error
    const rows = (data ?? []) as Row[]
    return rows
      .filter((r) => r.companies)
      .map((r) => ({
        id: r.companies!.id,
        name: r.companies!.name,
        invite_code: r.companies!.invite_code,
        is_onboarding_completed: r.companies!.is_onboarding_completed,
        membership: {
          company_id: r.company_id,
          user_id: r.user_id,
          role_id: r.role_id,
          is_admin: r.is_admin,
          is_active: r.is_active
        }
      }))
  },

  async createCompany({ name }: { name: string }) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!userData.user?.id) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('companies')
      .insert({ name, created_by_user_id: userData.user.id })
      .select('id')
      .single()

    if (error) throw error
    return data as { id: string }
  },

  async joinByInviteCode(inviteCode: string) {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { mode: 'join_by_invite_code', invite_code: inviteCode }
    })
    if (error) throw error
    return data
  }
}
