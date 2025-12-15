import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContractDetailPage from './ContractDetailPage'

vi.mock('../contexts/CompanyContext', () => ({
  useCompany: () => ({ activeCompanyId: 'company-1' })
}))

vi.mock('../services/contractsService', () => ({
  contractsService: {
    getContract: async () => ({
      id: 'c1',
      company_id: 'company-1',
      title: 'NDA',
      description: null,
      status: 'draft',
      counterparty_name: 'Contoso',
      effective_date: null,
      end_date: null,
      total_value: null,
      currency: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      content: '<p>Hello</p>'
    })
  }
}))

vi.mock('../components/contracts/ContractOverview', () => ({ default: () => <div>Overview</div> }))
vi.mock('../components/contracts/ContractEditor', () => ({ default: () => <div>Editor</div> }))
vi.mock('../components/contracts/ContractDocuments', () => ({ default: () => <div>Documents</div> }))
vi.mock('../components/contracts/ContractVersions', () => ({ default: () => <div>Versions</div> }))
vi.mock('../components/contracts/ContractAiInsights', () => ({ default: () => <div>AI</div> }))
vi.mock('../components/contracts/ContractActivity', () => ({ default: () => <div>Activity</div> }))

describe('ContractDetailPage', () => {
  it('renders contract title', async () => {
    render(
      <MemoryRouter initialEntries={['/app/contracts/c1']}>
        <Routes>
          <Route path="/app/contracts/:contractId" element={<ContractDetailPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('NDA')).toBeInTheDocument()
    expect(screen.getByText('Contoso')).toBeInTheDocument()
  })
})

