import { describe, expect, it, vi } from 'vitest'

const eq = vi.fn()
const order = vi.fn()
const range = vi.fn()
const select = vi.fn()
const or = vi.fn()

const query = {
  select: (...args: any[]) => {
    select(...args)
    return query
  },
  eq: (...args: any[]) => {
    eq(...args)
    return query
  },
  order: (...args: any[]) => {
    order(...args)
    return query
  },
  range: (...args: any[]) => {
    range(...args)
    return query
  },
  or: (...args: any[]) => {
    or(...args)
    return query
  },
  then: (onFulfilled: any, _onRejected: any) => {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled)
  }
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => query
  }
}))

import { contractsService } from './contractsService'

describe('contractsService.listContracts', () => {
  it('always scopes by company_id', async () => {
    await contractsService.listContracts({ companyId: 'company-1', page: 1, pageSize: 20 })
    expect(eq).toHaveBeenCalledWith('company_id', 'company-1')
  })
})
