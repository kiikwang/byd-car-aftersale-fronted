import type { UserRole } from './roles'

export interface DashboardKpi {
  label: string
  value: string | number
  type: '' | 'success' | 'warning' | 'danger'
}

export interface RoleDashboardConfig {
  title: string
  subtitle: string
  showOrderStatusChart: boolean
  showFaultPie: boolean
  showPartsStockBar: boolean
  showFaultTable: boolean
  showOwnerPanel: boolean
  showManagerPanel?: boolean
}

/** 各角色看板布局配置；KPI 数字在 dashboard/index.vue 中按 API 数据实时计算 */
export const DASHBOARD_BY_ROLE: Record<UserRole, RoleDashboardConfig> = {
  OWNER: {
    title: '我的车辆',
    subtitle: '查看爱车状态、预约与维修进度',
    showOrderStatusChart: false,
    showFaultPie: false,
    showPartsStockBar: false,
    showFaultTable: false,
    showOwnerPanel: true,
  },
  ADVISOR: {
    title: '顾问工作台',
    subtitle: '今日预约接待与故障处理',
    showOrderStatusChart: false,
    showFaultPie: false,
    showPartsStockBar: false,
    showFaultTable: false,
    showOwnerPanel: false,
  },
  TECHNICIAN: {
    title: '技师工作台',
    subtitle: '工单维修与备件领用',
    showOrderStatusChart: false,
    showFaultPie: false,
    showPartsStockBar: false,
    showFaultTable: false,
    showOwnerPanel: false,
  },
  PART_ADMIN: {
    title: '备件管理与领用审批',
    subtitle: '审批技师领用申请 · 库存监控与预警',
    showOrderStatusChart: false,
    showFaultPie: false,
    showPartsStockBar: true,
    showFaultTable: false,
    showOwnerPanel: false,
  },
  SERVICE_MANAGER: {
    title: '服务经理工作台',
    subtitle: '门店运营监管 · 异常督办 · 结算审核 · 技师负荷',
    showOrderStatusChart: true,
    showFaultPie: true,
    showPartsStockBar: true,
    showFaultTable: true,
    showOwnerPanel: false,
    showManagerPanel: true,
  },
  ADMIN: {
    title: '统计看板',
    subtitle: '全系统运营数据总览',
    showOrderStatusChart: true,
    showFaultPie: true,
    showPartsStockBar: true,
    showFaultTable: true,
    showOwnerPanel: false,
  },
}
