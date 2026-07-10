import type { UserRole } from '@/constants/roles'

/** 车主只看自己的数据；顾问车辆由后端 advisorId 过滤；管理员/经理看全部 */
export function isOwnerScope(role: UserRole): boolean {
  return role === 'OWNER'
}

export function filterByOwner<T extends { ownerId?: number; vin?: string }>(
  items: T[],
  role: UserRole,
  ownerId?: number,
  ownerVins?: string[],
): T[] {
  if (!isOwnerScope(role) || !ownerId) return items
  return items.filter(
    (item) =>
      (item.ownerId !== undefined && item.ownerId === ownerId) ||
      (item.vin !== undefined && ownerVins?.includes(item.vin)),
  )
}

export function filterByVinScope<T extends { vin: string }>(
  items: T[],
  role: UserRole,
  ownerVins: string[],
): T[] {
  if (!isOwnerScope(role) || ownerVins.length === 0) return items
  return items.filter((item) => ownerVins.includes(item.vin))
}
