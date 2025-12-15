import { supabase } from '../lib/supabaseClient'
import type { ContractDocument, UUID } from '../types'

export const documentsService = {
  storagePathFor(companyId: UUID, contractId: UUID, fileName: string) {
    return `${companyId}/contracts/${contractId}/${fileName}`
  },

  async list(companyId: UUID, contractId: UUID): Promise<ContractDocument[]> {
    const { data, error } = await supabase
      .from('contract_documents')
      .select(
        'id,company_id,contract_id,version_id,file_name,storage_bucket,storage_path,file_type,file_size_bytes,uploaded_at'
      )
      .eq('company_id', companyId)
      .eq('contract_id', contractId)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ContractDocument[]
  },

  async upload(companyId: UUID, contractId: UUID, file: File) {
    const storagePath = this.storagePathFor(companyId, contractId, file.name)
    const { error: uploadError } = await supabase.storage.from('contracts').upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined
    })
    if (uploadError) throw uploadError

    const { data, error } = await supabase
      .from('contract_documents')
      .insert({
        contract_id: contractId,
        file_name: file.name,
        storage_path: storagePath,
        file_type: file.type || null,
        file_size_bytes: file.size
      })
      .select(
        'id,company_id,contract_id,version_id,file_name,storage_bucket,storage_path,file_type,file_size_bytes,uploaded_at'
      )
      .single()
    if (error) throw error
    return data as ContractDocument
  },

  async createSignedDownloadUrl(storagePath: string, expiresInSeconds = 60) {
    const { data, error } = await supabase.storage.from('contracts').createSignedUrl(storagePath, expiresInSeconds)
    if (error) throw error
    return data.signedUrl
  }
}

