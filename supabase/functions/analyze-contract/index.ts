import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient, requireCompanyPermission, requireUser } from '../_shared/supabase.ts'

type Body = { company_id: string; contract_id: string }

async function callGemini(apiKey: string, prompt: string) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? 'Gemini error')
  return json
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
  if (!body.company_id || !body.contract_id) return jsonResponse(400, { error: 'Missing fields' })

  const perm = await requireCompanyPermission(auth.user.id, body.company_id, 'ai.manage')
  if (!perm.ok) return jsonResponse(perm.status, { error: perm.error })

  const supabase = getAdminClient()
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id,title,content,status')
    .eq('company_id', body.company_id)
    .eq('id', body.contract_id)
    .single()
  if (contractError) return jsonResponse(500, { error: contractError.message })

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return jsonResponse(500, { error: 'Missing GEMINI_API_KEY' })

  const prompt = [
    'You are a contract analysis assistant for an enterprise CLM.',
    'Return JSON with keys: summary, risks (array), obligations (array), key_dates (array), suggested_redlines (array).',
    `Contract title: ${contract.title}`,
    `Contract status: ${contract.status}`,
    'Contract HTML:',
    contract.content ?? ''
  ].join('\n')

  try {
    const gemini = await callGemini(apiKey, prompt)
    const insights = {
      contract_id: body.contract_id,
      generated_at: new Date().toISOString(),
      gemini
    }

    await supabase.from('company_settings').upsert(
      { company_id: body.company_id, key: `contract_ai_insights:${body.contract_id}`, value: insights },
      { onConflict: 'company_id,key' }
    )

    return jsonResponse(200, { ok: true, insights })
  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message })
  }
})

