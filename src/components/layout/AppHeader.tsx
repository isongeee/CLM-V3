import { Link, NavLink } from 'react-router-dom'
import { Building2, FileText, LayoutDashboard, LogOut, PenLine, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import Button from '../ui/Button'
import Select from '../ui/Select'

export default function AppHeader() {
  const { signOut, user } = useAuth()
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany()

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/app/dashboard" className="flex items-center gap-2 font-semibold">
          <PenLine className="h-5 w-5" />
          <span>V3 CLM</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-2 sm:flex">
          <NavLink
            to="/app/dashboard"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink
            to="/app/contracts"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`
            }
          >
            <FileText className="h-4 w-4" />
            Contracts
          </NavLink>
          <NavLink
            to="/app/signing"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`
            }
          >
            <Building2 className="h-4 w-4" />
            Signing
          </NavLink>
          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Select
            ariaLabel="Active company"
            value={activeCompanyId ?? ''}
            onChange={(value) => setActiveCompanyId(value || null)}
            options={[
              { value: '', label: 'Select company…' },
              ...companies.map((c) => ({ value: c.id, label: c.name }))
            ]}
          />
          <div className="hidden text-sm text-slate-600 sm:block">{user?.email}</div>
          <Button variant="ghost" onClick={signOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}

