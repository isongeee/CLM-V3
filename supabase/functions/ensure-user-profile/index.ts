import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient, requireUser } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const auth = await requireUser(req)
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error })

  const supabase = getAdminClient()
  const email = auth.user.email ?? ''
  const fullName =
    (auth.user.user_metadata?.full_name as string | undefined) ??
    (auth.user.user_metadata?.name as string | undefined) ??
    null

  const { error } = await supabase.from('users').upsert(
    {
      id: auth.user.id,
      email,
      full_name: fullName
    },
    { onConflict: 'id' }
  )

  if (error) return jsonResponse(500, { error: error.message })
  return jsonResponse(200, { ok: true })
})

