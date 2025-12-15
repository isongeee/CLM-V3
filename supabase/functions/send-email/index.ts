import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireCompanyPermission, requireUser } from '../_shared/supabase.ts'

type Body = {
  company_id: string
  to: string
  subject: string
  html?: string
  text?: string
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

  if (!body.company_id || !body.to || !body.subject) return jsonResponse(400, { error: 'Missing fields' })
  const perm = await requireCompanyPermission(auth.user.id, body.company_id, 'org.manage')
  if (!perm.ok) return jsonResponse(perm.status, { error: perm.error })

  const apiKey = Deno.env.get('SENDGRID_API_KEY')
  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') ?? 'no-reply@example.com'

  if (!apiKey) {
    return jsonResponse(200, { ok: true, sent: false, message: 'SENDGRID_API_KEY not set (stubbed)' })
  }

  const payload = {
    personalizations: [{ to: [{ email: body.to }] }],
    from: { email: fromEmail },
    subject: body.subject,
    content: [
      ...(body.text ? [{ type: 'text/plain', value: body.text }] : []),
      ...(body.html ? [{ type: 'text/html', value: body.html }] : [])
    ]
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const text = await res.text()
    return jsonResponse(500, { error: `SendGrid error: ${res.status} ${text}` })
  }

  return jsonResponse(200, { ok: true, sent: true })
})

