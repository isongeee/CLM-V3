import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const companyName = process.env.SEED_COMPANY_NAME ?? 'Demo Co'
const createdByUserId = process.env.SEED_CREATOR_USER_ID ?? null

const { data: company, error: companyError } = await supabase
  .from('companies')
  .insert({ name: companyName, created_by_user_id: createdByUserId })
  .select('id,invite_code')
  .single()

if (companyError) throw companyError
console.log('Created company:', company)
