import { supabase } from '../lib/supabaseClient'
import type { Contract, ContractStatus, ContractVersion, UUID } from '../types'

type ListParams = {
  companyId: UUID
  page: number
  pageSize: number
  status?: ContractStatus | 'all'
  search?: string
}

export const contractsService = {
  async listContracts(params: ListParams): Promise<{ contracts: Contract[]; total: number }> {
    const { companyId, page, pageSize, status = 'all', search } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('contracts')
      .select(
        'id,company_id,title,description,status,counterparty_name,effective_date,end_date,total_value,currency,created_at,updated_at,content',
        { count: 'exact' }
      )
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (status !== 'all') query = query.eq('status', status)
    if (search && search.trim()) {
      const q = search.trim()
      query = query.or(`title.ilike.%${q}%,counterparty_name.ilike.%${q}%`)
    }

    const { data, error, count } = await query
    if (error) throw error
    return { contracts: (data ?? []) as Contract[], total: count ?? 0 }
  },

  async getContract(companyId: UUID, contractId: UUID): Promise<Contract & { content: string | null }> {
    const { data, error } = await supabase
      .from('contracts')
      .select(
        'id,company_id,title,description,status,counterparty_name,effective_date,end_date,total_value,currency,created_at,updated_at,content'
      )
      .eq('company_id', companyId)
      .eq('id', contractId)
      .single()

    if (error) throw error
    return data as Contract & { content: string | null }
  },

  async createContract(companyId: UUID, title: string): Promise<Contract> {
    const { data, error } = await supabase
      .from('contracts')
      .insert({ company_id: companyId, title, status: 'draft' })
      .select(
        'id,company_id,title,description,status,counterparty_name,effective_date,end_date,total_value,currency,created_at,updated_at,content'
      )
      .single()

    if (error) throw error
    return data as Contract
  },

  async updateStatus(companyId: UUID, contractId: UUID, nextStatus: ContractStatus) {
    const { data, error } = await supabase
      .from('contracts')
      .update({ status: nextStatus })
      .eq('company_id', companyId)
      .eq('id', contractId)
      .select('id,status,updated_at')
      .single()
    if (error) throw error
    return data as { id: UUID; status: ContractStatus; updated_at: string }
  },

  async listVersions(companyId: UUID, contractId: UUID): Promise<ContractVersion[]> {
    await this.getContract(companyId, contractId)
    const { data, error } = await supabase
      .from('contract_versions')
      .select('id,contract_id,version_number,status,created_at,content,summary')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
    if (error) throw error
    return (data ?? []) as ContractVersion[]
  },

  async saveNewVersion(companyId: UUID, contractId: UUID, content: string): Promise<ContractVersion> {
    const contract = await this.getContract(companyId, contractId)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!userData.user?.id) throw new Error('Not authenticated')

    const { data: latest, error: latestError } = await supabase
      .from('contract_versions')
      .select('version_number')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestError) throw latestError

    const nextVersionNumber = (latest?.version_number ?? 0) + 1

    const { data: inserted, error: insertError } = await supabase
      .from('contract_versions')
      .insert({
        contract_id: contractId,
        version_number: nextVersionNumber,
        status: contract.status,
        author_id: userData.user.id,
        content
      })
      .select('id,contract_id,version_number,status,created_at,content,summary')
      .single()
    if (insertError) throw insertError

    const { error: updateError } = await supabase
      .from('contracts')
      .update({ content })
      .eq('company_id', companyId)
      .eq('id', contractId)
    if (updateError) throw updateError

    try {
      await supabase.functions.invoke('create-audit-log', {
        body: {
          company_id: companyId,
          entity_type: 'contract_version',
          entity_id: inserted.id,
          action: 'updated',
          new_value: { contract_id: contractId, version_number: nextVersionNumber }
        }
      })
    } catch {
      // ignore
    }

    return inserted as ContractVersion
  }
}

