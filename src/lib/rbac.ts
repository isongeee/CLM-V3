import type { PermissionKey } from '../types'

export function canPermission(args: {
  isAdmin: boolean
  permissionKeys: PermissionKey[]
  permission: PermissionKey
}) {
  if (args.isAdmin) return true
  return args.permissionKeys.includes(args.permission)
}

