import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { vehicleApi, type VehicleListParams } from '@/api'
import { filterByOwner } from '@/utils/role-scope'
import { enrichVehicles } from '@/utils/vehicle-enrich'
import type { Vehicle } from '@/types'

const vehicleCache = ref<Vehicle[]>([])
const loaded = ref(false)

export function resetVehicleCache() {
  loaded.value = false
  vehicleCache.value = []
}

/** 按角色生成车辆列表查询参数：顾问仅查自己负责的车辆 */
export function buildVehicleListParams(role: string, userId: number): VehicleListParams | undefined {
  if (role === 'ADVISOR' && userId) {
    return { advisorId: userId }
  }
  return undefined
}

export async function reloadVehicles() {
  const userStore = useUserStore()
  const params = buildVehicleListParams(userStore.role, userStore.userId)
  vehicleCache.value = enrichVehicles(await vehicleApi.list(params))
  loaded.value = true
}

async function ensureVehicles() {
  if (loaded.value) return
  await reloadVehicles()
}

/** 按当前登录角色返回可见车辆列表 */
export function useScopedVehicles() {
  const userStore = useUserStore()
  ensureVehicles()
  return computed(() => {
    if (userStore.isOwner) {
      const ownerId = userStore.ownerId || userStore.userId
      return ownerId ? vehicleCache.value.filter((v) => v.ownerId === ownerId) : []
    }
    return vehicleCache.value
  })
}

export function getOwnerVins(vehicles: Vehicle[]): string[] {
  return vehicles.map((v) => v.vin)
}

export function useOwnerVins() {
  const scoped = useScopedVehicles()
  return computed(() => getOwnerVins(scoped.value))
}

export function scopeByOwner<T extends { ownerId?: number }>(items: T[]) {
  const userStore = useUserStore()
  return filterByOwner(items, userStore.role, userStore.ownerId)
}

export function scopeByVin<T extends { vin: string }>(items: T[], vins: string[]) {
  const userStore = useUserStore()
  if (userStore.isOwner && vins.length > 0) {
    return items.filter((item) => vins.includes(item.vin))
  }
  return items
}
