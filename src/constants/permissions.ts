import type { UserRole } from './roles'

export type ModuleKey =
  | 'dashboard'
  | 'vehicle'
  | 'appointment'
  | 'fault'
  | 'agent'
  | 'workOrder'
  | 'parts'
  | 'battery'
  | 'settlement'
  | 'system'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'confirm'
  | 'cancel'
  | 'assign'
  | 'updateProgress'
  | 'applyPart'
  | 'approvePart'
  | 'remindOwner'
  | 'settle'
  | 'approveSettlement'
  | 'supervise'
  | 'reassign'

type PermSet = Partial<Record<ModuleKey, PermissionAction[]>>

/** 各角色模块操作权限（与业务需求对齐） */
export const ROLE_PERMISSIONS: Record<UserRole, PermSet> = {
  OWNER: {
    dashboard: ['view'],
    vehicle: ['view'],
    appointment: ['view', 'create', 'cancel'],
    workOrder: ['view'],
    battery: ['view'],
    settlement: ['view'],
  },
  ADVISOR: {
    dashboard: ['view'],
    vehicle: ['view', 'create', 'edit', 'delete'],
    appointment: ['view', 'confirm', 'cancel'],
    fault: ['view', 'create', 'edit'],
    workOrder: ['view', 'create', 'assign'],
    battery: ['view'],
    settlement: ['view', 'create'],
  },
  TECHNICIAN: {
    dashboard: ['view'],
    vehicle: ['view'],
    workOrder: ['view', 'updateProgress'],
    parts: ['view', 'applyPart'],
    fault: ['view'],
    agent: ['view', 'create'],
  },
  PART_ADMIN: {
    dashboard: ['view'],
    parts: ['view', 'create', 'edit', 'delete', 'approvePart'],
  },
  SERVICE_MANAGER: {
    dashboard: ['view'],
    vehicle: ['view'],
    appointment: ['view', 'confirm'],
    fault: ['view'],
    workOrder: ['view', 'supervise', 'reassign', 'assign'],
    parts: ['view'],
    battery: ['view', 'remindOwner'],
    settlement: ['view', 'approveSettlement'],
  },
  ADMIN: {
    dashboard: ['view'],
    vehicle: ['view', 'create', 'edit', 'delete'],
    appointment: ['view', 'create', 'edit', 'confirm', 'cancel'],
    fault: ['view', 'create', 'edit', 'delete'],
    workOrder: ['view', 'create', 'assign', 'updateProgress'],
    parts: ['view', 'create', 'edit', 'delete', 'approvePart'],
    battery: ['view', 'remindOwner'],
    settlement: ['view', 'create', 'settle'],
    system: ['view', 'create', 'edit', 'delete'],
  },
}

export function canDo(role: UserRole, module: ModuleKey, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.[module]?.includes(action) ?? false
}
