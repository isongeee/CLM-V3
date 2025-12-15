import { describe, expect, it } from 'vitest'
import { canPermission } from './rbac'

describe('canPermission', () => {
  it('allows admin', () => {
    expect(canPermission({ isAdmin: true, permissionKeys: [], permission: 'contracts.delete' })).toBe(true)
  })

  it('checks permission keys', () => {
    expect(
      canPermission({
        isAdmin: false,
        permissionKeys: ['contracts.create', 'contracts.update'],
        permission: 'contracts.update'
      })
    ).toBe(true)
    expect(
      canPermission({
        isAdmin: false,
        permissionKeys: ['contracts.create', 'contracts.update'],
        permission: 'contracts.delete'
      })
    ).toBe(false)
  })
})

