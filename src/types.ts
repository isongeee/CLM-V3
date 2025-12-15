export type UUID = string

export type ContractStatus =
  | 'draft'
  | 'in_review'
  | 'pending_approval'
  | 'sent_for_signature'
  | 'fully_executed'
  | 'active'
  | 'expired'
  | 'terminated'
  | 'superseded'
  | 'archived'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'canceled'

export type PermissionKey =
  | 'roles.manage'
  | 'org.manage'
  | 'templates.manage'
  | 'clause_library.manage'
  | 'workflows.manage'
  | 'contracts.create'
  | 'contracts.update'
  | 'contracts.delete'
  | 'contracts.approve'
  | 'contracts.send_for_signature'
  | 'ai.manage'
  | 'audit.view'

export type Company = {
  id: UUID
  name: string
  invite_code: string | null
  is_onboarding_completed: boolean | null
}

export type CompanyMembership = {
  company_id: UUID
  user_id: UUID
  role_id: UUID | null
  is_admin: boolean
  is_active: boolean
}

export type CompanySummary = Company & {
  membership: CompanyMembership
}

export type Contract = {
  id: UUID
  company_id: UUID
  title: string
  description: string | null
  status: ContractStatus
  counterparty_name: string | null
  effective_date: string | null
  end_date: string | null
  total_value: number | null
  currency: string | null
  content?: string | null
  created_at: string
  updated_at: string
}

export type ContractVersion = {
  id: UUID
  contract_id: UUID
  version_number: number
  status: string
  created_at: string
  content: string | null
  summary: string | null
}

export type ContractDocument = {
  id: UUID
  company_id: UUID
  contract_id: UUID
  version_id: UUID | null
  file_name: string
  storage_bucket: 'contracts'
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
}
