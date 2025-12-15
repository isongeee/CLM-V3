import { describe, expect, it } from 'vitest'
import { documentsService } from './documentsService'

describe('documentsService.storagePathFor', () => {
  it('uses tenant-scoped private path convention', () => {
    const path = documentsService.storagePathFor('company-1', 'contract-1', 'file.pdf')
    expect(path).toBe('company-1/contracts/contract-1/file.pdf')
  })
})

