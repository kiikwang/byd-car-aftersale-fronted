/** 从路由 query 读取字符串 */
export function queryString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 解析逗号分隔的状态列表，如 PENDING,CONFIRMED */
export function parseStatusList(queryValue: string): string[] {
  if (!queryValue) return []
  return queryValue.split(',').map((s) => s.trim()).filter(Boolean)
}

export function matchesStatus(status: string, allowed: string[]): boolean {
  return allowed.length === 0 || allowed.includes(status)
}

export function isToday(dateTime?: string): boolean {
  if (!dateTime) return false
  const d = new Date(dateTime.replace(' ', 'T'))
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
}

export function isThisMonth(dateTime?: string): boolean {
  if (!dateTime) return false
  const d = new Date(dateTime.replace(' ', 'T'))
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/** 预约页 scope 与状态映射（与看板统计口径一致） */
export const APPOINTMENT_SCOPE_STATUSES: Record<string, string[]> = {
  needFault: ['CONFIRMED', 'ARRIVED'],
  active: ['PENDING', 'CONFIRMED', 'ARRIVED'],
}

/** 工单页 scope 与状态映射 */
export const WORK_ORDER_SCOPE_STATUSES: Record<string, string[]> = {
  supervise: ['CREATED', 'PART_WAITING'],
  inProgress: ['ASSIGNED', 'IN_PROGRESS', 'PART_WAITING'],
  completed: ['COMPLETED'],
}

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  ARRIVED: '已到店',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  CREATED: '待派工',
  ASSIGNED: '已派工',
  IN_PROGRESS: '维修中',
  PART_WAITING: '待备件',
  COMPLETED: '已完工',
  CANCELLED: '已取消',
}

const FAULT_STATUS_LABEL: Record<string, string> = {
  REGISTERED: '已登记待诊断',
  DIAGNOSED: '已诊断',
  WORK_ORDER_CREATED: '已建工单',
  CLOSED: '已关闭',
}

export function appointmentFilterLabel(scope: string, statuses: string[], todayOnly: boolean): string {
  if (scope === 'needFault') return '待登记故障（已确认/已到店预约）'
  if (scope === 'active') return '进行中预约'
  const parts: string[] = []
  if (statuses.length) {
    parts.push(statuses.map((s) => APPOINTMENT_STATUS_LABEL[s] || s).join('、'))
  }
  if (todayOnly) parts.push('今日预约')
  return parts.join(' · ') || '全部'
}

export function workOrderFilterLabel(scope: string, statuses: string[]): string {
  if (scope === 'supervise') return '待督办工单（待派工/待备件）'
  if (scope === 'inProgress') return '在修工单'
  if (scope === 'completed') return '已完工工单'
  if (scope === 'month') return '本月工单'
  if (statuses.length === 1) return WORK_ORDER_STATUS_LABEL[statuses[0]] || statuses[0]
  if (statuses.length > 1) return statuses.map((s) => WORK_ORDER_STATUS_LABEL[s] || s).join('、')
  return '全部'
}

export function faultFilterLabel(statuses: string[]): string {
  if (statuses.length === 1) return FAULT_STATUS_LABEL[statuses[0]] || statuses[0]
  if (statuses.length > 1) return statuses.map((s) => FAULT_STATUS_LABEL[s] || s).join('、')
  return '全部'
}
