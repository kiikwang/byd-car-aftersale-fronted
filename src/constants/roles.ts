/** 与数据表 sys_user.role 字段一致 */
export type UserRole =
  | 'OWNER'
  | 'ADVISOR'
  | 'TECHNICIAN'
  | 'PART_ADMIN'
  | 'SERVICE_MANAGER'
  | 'ADMIN'

export interface RoleConfig {
  value: UserRole
  label: string
  desc: string
  icon: string
  /** 可访问的路由 path（不含前缀 /） */
  routes: string[]
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  OWNER: {
    value: 'OWNER',
    label: '车主',
    desc: '发起预约、查看维修与结算进度',
    icon: 'User',
    routes: ['dashboard', 'vehicle', 'appointment', 'work-order', 'battery', 'settlement'],
  },
  ADVISOR: {
    value: 'ADVISOR',
    label: '售后顾问',
    desc: '客户车辆维护、预约接待、故障登记与派工',
    icon: 'Service',
    routes: ['dashboard', 'vehicle', 'appointment', 'service-center', 'fault', 'work-order', 'battery', 'settlement'],
  },
  TECHNICIAN: {
    value: 'TECHNICIAN',
    label: '维修技师',
    desc: '接单维修、Agent 诊断、申请备件',
    icon: 'Tools',
    routes: ['dashboard', 'work-order', 'parts', 'agent'],
  },
  PART_ADMIN: {
    value: 'PART_ADMIN',
    label: '备件管理员',
    desc: '备件库存管理与领用审批',
    icon: 'Box',
    routes: ['dashboard', 'parts'],
  },
  SERVICE_MANAGER: {
    value: 'SERVICE_MANAGER',
    label: '服务经理',
    desc: '门店运营监管与电池预警提醒',
    icon: 'DataAnalysis',
    routes: [
      'dashboard',
      'vehicle',
      'appointment',
      'service-center',
      'fault',
      'work-order',
      'parts',
      'battery',
      'settlement',
    ],
  },
  ADMIN: {
    value: 'ADMIN',
    label: '系统管理员',
    desc: '车辆档案与用户权限管理',
    icon: 'Setting',
    routes: [
      'dashboard',
      'vehicle',
      'appointment',
      'service-center',
      'fault',
      'work-order',
      'parts',
      'battery',
      'settlement',
      'system',
    ],
  },
}

export const ROLE_LIST = Object.values(ROLE_CONFIG)

export function hasRouteAccess(role: UserRole, path: string): boolean {
  const routeKey = path.replace(/^\//, '').split('/')[0]
  if (!routeKey) return true
  return ROLE_CONFIG[role]?.routes.includes(routeKey) ?? false
}
