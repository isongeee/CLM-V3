import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient, requireCompanyPermission, requireUser } from '../_shared/supabase.ts'

type JoinBody = { mode: 'join_by_invite_code'; invite_code: string }
type AdminAddBody = {
  mode: 'admin_add_by_email'
  company_id: string
  email: string
  role_id?: string | null
  is_admin?: boolean
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const auth = await requireUser(req)
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error })

  let body: JoinBody | AdminAddBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }

  const supabase = getAdminClient()

  if (body.mode === 'join_by_invite_code') {
    const inviteCode = body.invite_code?.trim()
    if (!inviteCode) return jsonResponse(400, { error: 'Missing invite_code' })
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle()
    if (companyError) return jsonResponse(500, { error: companyError.message })
    if (!company) return jsonResponse(404, { error: 'Invalid invite code' })

    const { error: upsertError } = await supabase.from('company_users').upsert(
      {
        company_id: company.id,
        user_id: auth.user.id,
        is_admin: false,
        is_active: true,
        joined_at: new Date().toISOString()
      },
      { onConflict: 'company_id,user_id' }
    )
    if (upsertError) return jsonResponse(500, { error: upsertError.message })

    return jsonResponse(200, { ok: true, company_id: company.id })
  }

  if (body.mode === 'admin_add_by_email') {
    const companyId = body.company_id
    const email = body.email?.trim().toLowerCase()
    if (!companyId || !email) return jsonResponse(400, { error: 'Missing company_id or email' })

    const perm = await requireCompanyPermission(auth.user.id, companyId, 'roles.manage')
    if (!perm.ok) return jsonResponse(perm.status, { error: perm.error })

    const { data: targetUser, error: targetError } = await supabase.auth.admin.getUserByEmail(email)
    if (targetError) return jsonResponse(500, { error: targetError.message })
    if (!targetUser.user) return jsonResponse(404, { error: 'User not found (must sign up first)' })

    const { error: upsertError } = await supabase.from('company_users').upsert(
      {
        company_id: companyId,
        user_id: targetUser.user.id,
        role_id: body.role_id ?? null,
        is_admin: !!body.is_admin,
        is_active: true,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString()
      },
      { onConflict: 'company_id,user_id' }
    )
    if (upsertError) return jsonResponse(500, { error: upsertError.message })

    return jsonResponse(200, { ok: true })
  }

  return jsonResponse(400, { error: 'Invalid mode' })
})

