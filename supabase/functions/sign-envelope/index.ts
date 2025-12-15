import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient, requireCompanyMember, requireUser } from '../_shared/supabase.ts'

type Body = { company_id: string; envelope_id: string }

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
  if (!body.company_id || !body.envelope_id) return jsonResponse(400, { error: 'Missing fields' })

  const member = await requireCompanyMember(auth.user.id, body.company_id)
  if (!member.ok) return jsonResponse(member.status, { error: member.error })

  const supabase = getAdminClient()

  const { data: recipient, error: recipientError } = await supabase
    .from('signature_recipients')
    .select('id,status,envelope_id,company_id')
    .eq('company_id', body.company_id)
    .eq('envelope_id', body.envelope_id)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (recipientError) return jsonResponse(500, { error: recipientError.message })
  if (!recipient) return jsonResponse(404, { error: 'No signature task for this user' })

  if (recipient.status === 'signed') return jsonResponse(200, { ok: true, status: 'already_signed' })

  const now = new Date().toISOString()

  const { error: updateRecipientError } = await supabase
    .from('signature_recipients')
    .update({ status: 'signed', signed_at: now })
    .eq('id', recipient.id)
  if (updateRecipientError) return jsonResponse(500, { error: updateRecipientError.message })

  const { error: eventError } = await supabase.from('signature_events').insert({
    envelope_id: body.envelope_id,
    recipient_id: recipient.id,
    company_id: body.company_id,
    event_type: 'recipient.signed',
    payload: { user_id: auth.user.id, email: auth.user.email }
  })
  if (eventError) return jsonResponse(500, { error: eventError.message })

  const { data: remaining, error: remainingError } = await supabase
    .from('signature_recipients')
    .select('id')
    .eq('company_id', body.company_id)
    .eq('envelope_id', body.envelope_id)
    .neq('status', 'signed')
    .limit(1)
  if (remainingError) return jsonResponse(500, { error: remainingError.message })

  if ((remaining ?? []).length === 0) {
    await supabase
      .from('signature_envelopes')
      .update({ status: 'fully_signed', completed_at: now })
      .eq('id', body.envelope_id)
    await supabase.from('signature_events').insert({
      envelope_id: body.envelope_id,
      company_id: body.company_id,
      event_type: 'envelope.fully_signed',
      payload: { completed_at: now }
    })
  }

  return jsonResponse(200, { ok: true })
})
