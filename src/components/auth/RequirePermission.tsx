import type { PropsWithChildren } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import type { PermissionKey } from '../../types'
import Card from '../ui/Card'

export default function RequirePermission({
  permission,
  children
}: PropsWithChildren<{
  permission: PermissionKey
}>) {
  const { can } = useCompany()
  if (!can(permission)) {
    return (
      <Card>
        <div className="text-sm text-slate-700">You do not have permission: {permission}</div>
      </Card>
    )
  }
  return <>{children}</>
}

