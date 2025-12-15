import { NavLink, Outlet } from 'react-router-dom'

export default function SettingsLayout() {
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <aside className="rounded-lg border bg-white p-2">
        <nav className="grid gap-1">
          <SettingsLink to="/app/settings/onboarding" label="Onboarding" />
          <SettingsLink to="/app/settings/users-roles" label="Users & Roles" />
          <SettingsLink to="/app/settings/workflows" label="Workflows" />
          <SettingsLink to="/app/settings/ai" label="AI Config" />
          <SettingsLink to="/app/settings/billing" label="Billing" />
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

function SettingsLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`
      }
    >
      {label}
    </NavLink>
  )
}

