import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

export function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export function getAdminClient() {
  const url = getEnv('SUPABASE_URL')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { ok: false as const, status: 401, error: 'Missing Bearer token' }

  const supabase = getAdminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return { ok: false as const, status: 401, error: 'Invalid token' }

  return { ok: true as const, user: data.user, token }
}

export async function requireCompanyMember(userId: string, companyId: string) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('company_users')
    .select('company_id,user_id,role_id,is_admin,is_active')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return { ok: false as const, status: 403, error: 'Not a company member' }
  return { ok: true as const, membership: data as any }
}

export async function requireCompanyPermission(userId: string, companyId: string, permissionKey: string) {
  const member = await requireCompanyMember(userId, companyId)
  if (!member.ok) return member
  if (member.membership.is_admin) return { ok: true as const, membership: member.membership }

  if (!member.membership.role_id) {
    return { ok: false as const, status: 403, error: `Missing permission: ${permissionKey}` }
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('role_permissions')
    .select('id')
    .eq('company_id', companyId)
    .eq('role_id', member.membership.role_id)
    .eq('permission_key', permissionKey)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return { ok: false as const, status: 403, error: `Missing permission: ${permissionKey}` }
  return { ok: true as const, membership: member.membership }
}

