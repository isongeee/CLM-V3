import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { companyService } from '../services/companyService'
import { rbacService } from '../services/rbacService'
import type { CompanySummary, PermissionKey, UUID } from '../types'

type CompanyContextValue = {
  companies: CompanySummary[]
  isLoadingCompanies: boolean
  activeCompanyId: UUID | null
  activeCompany: CompanySummary | null
  setActiveCompanyId: (companyId: UUID | null) => void
  permissionKeys: PermissionKey[]
  can: (permissionKey: PermissionKey) => boolean
  isAdmin: boolean
  refreshCompanies: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

function storageKeyForUser(userId: string) {
  return `v3clm.activeCompanyId.${userId}`
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [activeCompanyId, setActiveCompanyIdState] = useState<UUID | null>(null)
  const [permissionKeys, setPermissionKeys] = useState<PermissionKey[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) ?? null,
    [activeCompanyId, companies]
  )

  const isAdmin = !!activeCompany?.membership.is_admin

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!user) {
        setCompanies([])
        setPermissionKeys([])
        setActiveCompanyIdState(null)
        setIsLoadingCompanies(false)
        return
      }
      setIsLoadingCompanies(true)
      const nextCompanies = await companyService.listMyCompanies()
      if (canceled) return
      setCompanies(nextCompanies)

      const stored = localStorage.getItem(storageKeyForUser(user.id))
      const storedValid = stored && nextCompanies.some((c) => c.id === stored)
      const nextActiveId =
        (storedValid ? stored : null) ?? (nextCompanies.length === 1 ? nextCompanies[0].id : null)
      setActiveCompanyIdState(nextActiveId)
      setIsLoadingCompanies(false)
    }
    load().catch(() => setIsLoadingCompanies(false))
    return () => {
      canceled = true
    }
  }, [user])

  useEffect(() => {
    let canceled = false
    async function loadPerms() {
      if (!user || !activeCompany) {
        setPermissionKeys([])
        return
      }
      if (activeCompany.membership.is_admin) {
        setPermissionKeys([])
        return
      }
      if (!activeCompany.membership.role_id) {
        setPermissionKeys([])
        return
      }
      const keys = await rbacService.listRolePermissionKeys(activeCompany.id, activeCompany.membership.role_id)
      if (canceled) return
      setPermissionKeys(keys)
    }
    loadPerms().catch(() => setPermissionKeys([]))
    return () => {
      canceled = true
    }
  }, [activeCompany, user])

  const value = useMemo<CompanyContextValue>(
    () => ({
      companies,
      isLoadingCompanies,
      activeCompanyId,
      activeCompany,
      setActiveCompanyId(companyId) {
        setActiveCompanyIdState(companyId)
        if (user) {
          if (!companyId) localStorage.removeItem(storageKeyForUser(user.id))
          else localStorage.setItem(storageKeyForUser(user.id), companyId)
        }
      },
      permissionKeys,
      can(permissionKey) {
        if (!activeCompany) return false
        if (activeCompany.membership.is_admin) return true
        return permissionKeys.includes(permissionKey)
      },
      isAdmin,
      async refreshCompanies() {
        if (!user) return
        const next = await companyService.listMyCompanies()
        setCompanies(next)
      }
    }),
    [activeCompany, activeCompanyId, companies, isAdmin, isLoadingCompanies, permissionKeys, user]
  )

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider')
  return ctx
}

