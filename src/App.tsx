import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import ContractsListPage from './pages/ContractsListPage'
import ContractDetailPage from './pages/ContractDetailPage'
import SigningHubPage from './pages/SigningHubPage'
import SettingsLayout from './pages/settings/SettingsLayout'
import OnboardingPage from './pages/settings/OnboardingPage'
import UsersRolesPage from './pages/settings/UsersRolesPage'
import WorkflowsPage from './pages/settings/WorkflowsPage'
import AiConfigPage from './pages/settings/AiConfigPage'
import BillingPage from './pages/settings/BillingPage'
import AppLayout from './components/layout/AppLayout'
import RequireAuth from './components/auth/RequireAuth'
import RequireCompany from './components/auth/RequireCompany'
import RequirePermission from './components/auth/RequirePermission'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route
                path="contracts"
                element={
                  <RequireCompany>
                    <ContractsListPage />
                  </RequireCompany>
                }
              />
              <Route
                path="contracts/:contractId"
                element={
                  <RequireCompany>
                    <ContractDetailPage />
                  </RequireCompany>
                }
              />
              <Route
                path="signing"
                element={
                  <RequireCompany>
                    <SigningHubPage />
                  </RequireCompany>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireCompany>
                    <SettingsLayout />
                  </RequireCompany>
                }
              >
                <Route index element={<Navigate to="/app/settings/onboarding" replace />} />
                <Route
                  path="onboarding"
                  element={
                    <RequirePermission permission="org.manage">
                      <OnboardingPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="users-roles"
                  element={
                    <RequirePermission permission="roles.manage">
                      <UsersRolesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="workflows"
                  element={
                    <RequirePermission permission="workflows.manage">
                      <WorkflowsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="ai"
                  element={
                    <RequirePermission permission="ai.manage">
                      <AiConfigPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="billing"
                  element={
                    <RequirePermission permission="org.manage">
                      <BillingPage />
                    </RequirePermission>
                  }
                />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
