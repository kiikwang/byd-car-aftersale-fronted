import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { canDo, type ModuleKey, type PermissionAction } from '@/constants/permissions'

export function usePermissions() {
  const userStore = useUserStore()

  const can = (module: ModuleKey, action: PermissionAction) =>
    canDo(userStore.role, module, action)

  const isOwner = computed(() => userStore.role === 'OWNER')
  const isAdvisor = computed(() => userStore.role === 'ADVISOR')
  const isTechnician = computed(() => userStore.role === 'TECHNICIAN')
  const isPartAdmin = computed(() => userStore.role === 'PART_ADMIN')
  const isServiceManager = computed(() => userStore.role === 'SERVICE_MANAGER')
  const isAdmin = computed(() => userStore.role === 'ADMIN')

  return { can, isOwner, isAdvisor, isTechnician, isPartAdmin, isServiceManager, isAdmin }
}
