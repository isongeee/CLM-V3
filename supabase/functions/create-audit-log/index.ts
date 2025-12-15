import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient, requireCompanyMember, requireUser } from '../_shared/supabase.ts'

type Body = {
  company_id: string
  entity_type: string
  entity_id?: string | null
  action: string
  old_value?: unknown | null
  new_value?: unknown | null
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const auth = await requireUser(req)
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }
  if (!body.company_id || !body.entity_type || !body.action) {
    return jsonResponse(400, { error: 'Missing required fields' })
  }

  const member = await requireCompanyMember(auth.user.id, body.company_id)
  if (!member.ok) return jsonResponse(member.status, { error: member.error })

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      company_id: body.company_id,
      actor_id: auth.user.id,
      actor_email: auth.user.email ?? null,
      entity_type: body.entity_type,
      entity_id: body.entity_id ?? null,
      action: body.action,
      old_value: body.old_value ?? null,
      new_value: body.new_value ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
      ip_address: req.headers.get('x-forwarded-for') ?? null
    })
    .select('id')
    .single()

  if (error) return jsonResponse(500, { error: error.message })
  return jsonResponse(200, { ok: true, id: data.id })
})

