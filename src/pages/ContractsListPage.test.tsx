import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContractsListPage from './ContractsListPage'

vi.mock('../contexts/CompanyContext', () => ({
  useCompany: () => ({ activeCompanyId: 'company-1', can: () => true })
}))

vi.mock('../services/contractsService', () => ({
  contractsService: {
    listContracts: async () => ({
      contracts: [
        {
          id: 'c1',
          company_id: 'company-1',
          title: 'MSA',
          description: null,
          status: 'draft',
          counterparty_name: 'Acme',
          effective_date: null,
          end_date: null,
          total_value: null,
          currency: 'USD',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content: null
        }
      ],
      total: 1
    }),
    createContract: async () => {
      throw new Error('not needed')
    }
  }
}))

describe('ContractsListPage', () => {
  it('renders contracts', async () => {
    render(
      <MemoryRouter>
        <ContractsListPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('MSA')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })
})

