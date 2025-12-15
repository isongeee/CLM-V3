import type { PropsWithChildren } from 'react'
import Card from '../ui/Card'
import { useCompany } from '../../contexts/CompanyContext'

export default function RequireCompany({ children }: PropsWithChildren) {
  const { activeCompanyId, isLoadingCompanies } = useCompany()

  if (isLoadingCompanies) return null
  if (!activeCompanyId) {
    return (
      <Card>
        <div className="text-sm text-slate-700">Select a company in the header to continue.</div>
      </Card>
    )
  }
  return <>{children}</>
}

