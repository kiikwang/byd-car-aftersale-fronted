<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useUserStore } from '@/stores/user'
import { DASHBOARD_BY_ROLE } from '@/constants/dashboard'
import { useScopedVehicles, useOwnerVins } from '@/composables/useScopedVehicles'
import { appointmentApi, batteryApi, dashboardApi, faultApi, partUsageApi, partsApi, reminderApi, settlementApi, userApi, workOrderApi } from '@/api'
import { filterLowStockParts } from '@/utils/low-stock'
import { ElMessage } from 'element-plus'
import { getWorkOrderProgress } from '@/utils/work-order-progress'
import { buildSupervisionMap, getSupervisionEntry, type SupervisionEntry } from '@/utils/supervision'
import { getServiceTypeConfig } from '@/constants/service-types'
import { getReminderLevelConfig } from '@/constants/reminder'
import { parseFaultDescription } from '@/utils/fault-form'
import type { Appointment, BatteryHealthRecord, FaultRecord, Part, PartUsageRecord, Settlement, Vehicle, VehicleReminder, WorkOrder } from '@/types'

use([CanvasRenderer, LineChart, BarChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const router = useRouter()
const userStore = useUserStore()
const scopedVehicles = useScopedVehicles()
const ownerVins = useOwnerVins()

const config = computed(() => DASHBOARD_BY_ROLE[userStore.role])

const stats = ref<any>()
const workOrders = ref<WorkOrder[]>([])
const appointments = ref<Appointment[]>([])
const batteryAlerts = ref<BatteryHealthRecord[]>([])
const parts = ref<Part[]>([])
const faults = ref<FaultRecord[]>([])
const settlements = ref<Settlement[]>([])
const pendingPartUsages = ref<PartUsageRecord[]>([])
const todayPartUsageCount = ref(0)
const technicians = ref<Array<{ userId: number; realName: string }>>([])
const supervisionByOrderId = ref<Record<number, SupervisionEntry>>({})
const ownerReminders = ref<VehicleReminder[]>([])
const lowStockAlerts = ref<string[]>([])

const unreadReminders = computed(() =>
  ownerReminders.value.filter((r) => r.status === 'UNREAD'),
)
const lowStockParts = computed(() => filterLowStockParts(parts.value, lowStockAlerts.value))

const partMap = computed(() =>
  Object.fromEntries(parts.value.filter((p) => p.partId).map((p) => [p.partId as number, p])),
)
const technicianMap = computed(() =>
  Object.fromEntries(technicians.value.map((u) => [u.userId, u.realName])),
)

function partUsageStockInsufficient(row: PartUsageRecord) {
  const stock = partMap.value[row.partId]?.stockQuantity
  return stock !== undefined && stock < row.quantity
}

type KpiType = '' | 'success' | 'warning' | 'danger'
type KpiItem = {
  label: string
  value: string | number
  type: KpiType
  actionPath?: string
  actionQuery?: Record<string, string>
}

/** 未结束、未取消的预约（车主「进行中」、顾问待办统计用） */
const ACTIVE_APPOINTMENT_STATUSES: Appointment['status'][] = ['PENDING', 'CONFIRMED', 'ARRIVED']

function isActiveAppointment(status: Appointment['status']) {
  return ACTIVE_APPOINTMENT_STATUSES.includes(status)
}

function serviceTypeConfig(serviceType?: Appointment['serviceType']) {
  return getServiceTypeConfig(serviceType)
}

function isToday(dateTime?: string) {
  if (!dateTime) return false
  const d = new Date(dateTime.replace(' ', 'T'))
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
}

function isThisMonth(dateTime?: string) {
  if (!dateTime) return false
  const d = new Date(dateTime.replace(' ', 'T'))
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}
const technicianWorkload = computed(() => stats.value?.technicianWorkload || [])
const faultMap = computed(() =>
  Object.fromEntries((faults.value || []).filter((f) => f.faultId).map((f) => [f.faultId as number, f])),
)
const ownerId = computed(() => userStore.ownerId || userStore.userId)
const vehicleMap = computed<Record<string, Vehicle>>(() =>
  Object.fromEntries(scopedVehicles.value.map((vehicle) => [vehicle.vin, vehicle])),
)
const recentFaultRows = computed(() =>
  faults.value.map((fault) => {
    const vehicle = vehicleMap.value[fault.vin]
    return {
      ...fault,
      licensePlate: fault.licensePlate || vehicle?.licensePlate || '—',
      model: fault.model || vehicle?.model || '—',
      ownerName: fault.ownerName || vehicle?.ownerName || '—',
    }
  }),
)

function enrichWorkOrder(w: WorkOrder) {
  const fault = faultMap.value[w.faultId || 0]
  return {
    ...w,
    vin: fault?.vin || w.vin || '',
    faultType: fault?.faultDescription || w.faultType || '-',
  }
}

function supervisionOf(workOrderId?: number) {
  return getSupervisionEntry(supervisionByOrderId.value, workOrderId)
}

const myWorkOrders = computed(() =>
  userStore.isOwner
    ? workOrders.value.map(enrichWorkOrder).filter((w) => ownerVins.value.includes(w.vin))
    : userStore.role === 'TECHNICIAN'
      ? workOrders.value.map(enrichWorkOrder).filter((w) => w.technicianId === userStore.userId)
      : workOrders.value.map(enrichWorkOrder),
)

const myAppointments = computed(() =>
  userStore.isOwner
    ? appointments.value.filter((a) => a.ownerId === ownerId.value && isActiveAppointment(a.status))
    : appointments.value.filter((a) => a.status === 'PENDING'),
)

/** 车主「最近预约」展示用，含已取消/已完成 */
const ownerRecentAppointments = computed(() =>
  appointments.value
    .filter((a) => a.ownerId === ownerId.value)
    .sort((a, b) => (b.appointmentTime || '').localeCompare(a.appointmentTime || '')),
)

const myBattery = computed(() => {
  if (userStore.isOwner) {
    return batteryAlerts.value.filter((b) => ownerVins.value.includes(b.vin))
  }
  return batteryAlerts.value
})

const latestOwnerBattery = computed(() =>
  myBattery.value
    .slice()
    .sort((a, b) => (b.detectTime || '').localeCompare(a.detectTime || ''))[0],
)

function batteryStatusText(record?: BatteryHealthRecord) {
  if (!record) return '暂无检测'
  if (record.warningLevel === 'DANGER') return '电池异常'
  if (record.warningLevel === 'WARNING') return '建议复检'
  return '电池正常'
}

function batteryStatusType(record?: BatteryHealthRecord) {
  if (!record) return 'info'
  return record.warningLevel === 'NORMAL' ? 'success' : record.warningLevel === 'DANGER' ? 'danger' : 'warning'
}

function reminderType(reminder: VehicleReminder) {
  return getReminderLevelConfig(reminder).type
}

function reminderLabel(reminder: VehicleReminder) {
  return getReminderLevelConfig(reminder).label
}

async function markReminderRead(reminder: VehicleReminder) {
  if (!ownerId.value) return
  await reminderApi.markRead(reminder.reminderId, ownerId.value)
  ownerReminders.value = ownerReminders.value.filter((r) => r.reminderId !== reminder.reminderId)
  ElMessage.success('已标记为已读')
}

function faultLevelText(level: FaultRecord['faultLevel']) {
  const map = { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '紧急' }
  return map[level] || level
}

function faultAdvisorJudgment(row: FaultRecord) {
  return parseFaultDescription(row.faultDescription).advisorJudgment || '—'
}

function faultLevelType(level: FaultRecord['faultLevel']) {
  if (level === 'CRITICAL') return 'danger'
  if (level === 'HIGH') return 'warning'
  if (level === 'MEDIUM') return 'info'
  return 'success'
}

const workOrderStatusMap = {
  CREATED: { label: '待派工', type: 'warning' as const },
  ASSIGNED: { label: '已派工', type: 'info' as const },
  IN_PROGRESS: { label: '正在维修', type: 'warning' as const },
  PART_WAITING: { label: '待备件', type: 'warning' as const },
  COMPLETED: { label: '已完工', type: 'success' as const },
  CANCELLED: { label: '已取消', type: 'info' as const },
}

const managerTodos = computed(() => {
  const todos: Array<{ id: string; title: string; desc: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; actionPath: string; actionLabel: string }> = []
  appointments.value
    .filter((a) => a.status === 'PENDING' && a.serviceType === 'EMERGENCY_RESCUE')
    .forEach((a) =>
      todos.push({
        id: `apt-${a.appointmentNo}`,
        title: `紧急救援预约：${a.appointmentNo}`,
        desc: `${a.ownerName || a.vin} · ${a.problemDescription}`,
        priority: 'HIGH',
        actionPath: `/appointment?appointmentNo=${a.appointmentNo}`,
        actionLabel: '处理',
      }),
    )
  workOrders.value
    .filter((w) => ['CREATED', 'PART_WAITING'].includes(w.status))
    .forEach((w) =>
      todos.push({
        id: `wo-${w.workOrderNo}`,
        title: w.status === 'CREATED' ? `工单待派工：${w.workOrderNo}` : `工单待备件：${w.workOrderNo}`,
        desc: `${faultMap.value[w.faultId || 0]?.vin || '-'} · ${faultMap.value[w.faultId || 0]?.faultDescription || '维修单'}`,
        priority: 'HIGH',
        actionPath: `/work-order/${w.workOrderId}`,
        actionLabel: '督办',
      }),
    )
  batteryAlerts.value
    .filter((b) => b.warningLevel !== 'NORMAL')
    .forEach((b) =>
      todos.push({
        id: `bat-${b.vin}`,
        title: `电池${b.warningLevel === 'DANGER' ? '异常' : '预警'}：${b.vin}`,
        desc: `SOH ${b.soh}%`,
        priority: b.warningLevel === 'DANGER' ? 'HIGH' : 'MEDIUM',
        actionPath: `/battery?vin=${b.vin}`,
        actionLabel: '查看',
      }),
    )
  parts.value
    .filter((p) => lowStockParts.value.some((low) => low.partId === p.partId))
    .forEach((p) =>
      todos.push({
        id: `part-${p.partNo}`,
        title: `库存预警：${p.partName}`,
        desc: `库存 ${p.stockQuantity} / 阈值 ${p.warningThreshold}`,
        priority: 'MEDIUM',
        actionPath: `/parts?partNo=${p.partNo}`,
        actionLabel: '处理',
      }),
    )
  return todos
})

const kpis = computed<KpiItem[]>(() => {
  const s = stats.value

  if (userStore.role === 'OWNER') {
    return [
      { label: '我的车辆', value: scopedVehicles.value.length, type: '', actionPath: '/vehicle' },
      { label: '进行中预约', value: myAppointments.value.length, type: 'warning', actionPath: '/appointment', actionQuery: { scope: 'active' } },
      { label: '维修中工单', value: myWorkOrders.value.filter((w) => ['ASSIGNED', 'IN_PROGRESS', 'PART_WAITING'].includes(w.status)).length, type: '', actionPath: '/work-order', actionQuery: { scope: 'inProgress' } },
      { label: '车辆健康', value: latestOwnerBattery.value ? `${latestOwnerBattery.value.soh}%` : '--', type: latestOwnerBattery.value?.warningLevel === 'NORMAL' ? 'success' : 'warning', actionPath: '/battery' },
    ]
  }

  if (userStore.role === 'TECHNICIAN') {
    const mine = myWorkOrders.value
    return [
      { label: '待开始', value: mine.filter((w) => w.status === 'ASSIGNED').length, type: 'warning', actionPath: '/work-order', actionQuery: { status: 'ASSIGNED' } },
      { label: '维修中', value: mine.filter((w) => w.status === 'IN_PROGRESS').length, type: '', actionPath: '/work-order', actionQuery: { status: 'IN_PROGRESS' } },
      { label: '待备件', value: mine.filter((w) => w.status === 'PART_WAITING').length, type: 'warning', actionPath: '/work-order', actionQuery: { status: 'PART_WAITING' } },
      { label: '已完工', value: mine.filter((w) => w.status === 'COMPLETED').length, type: 'success', actionPath: '/work-order', actionQuery: { status: 'COMPLETED' } },
    ]
  }

  if (userStore.role === 'ADVISOR') {
    const pendingAppointments = appointments.value.filter((a) => a.status === 'PENDING')
    const needFaultEntry = appointments.value.filter((a) => ['CONFIRMED', 'ARRIVED'].includes(a.status))
    const needAgent = faults.value.filter((f) => f.status === 'REGISTERED')
    const arrivedToday = appointments.value.filter((a) => a.status === 'ARRIVED' && isToday(a.appointmentTime))
    return [
      { label: '待确认预约', value: pendingAppointments.length, type: 'warning', actionPath: '/appointment', actionQuery: { status: 'PENDING' } },
      { label: '待登记故障', value: needFaultEntry.length, type: 'danger', actionPath: '/appointment', actionQuery: { scope: 'needFault' } },
      { label: '待技师诊断', value: needAgent.length, type: '', actionPath: '/fault', actionQuery: { status: 'REGISTERED' } },
      { label: '今日到店', value: arrivedToday.length, type: 'success', actionPath: '/appointment', actionQuery: { status: 'ARRIVED', today: '1' } },
    ]
  }

  if (userStore.role === 'PART_ADMIN') {
    const lowStock = lowStockParts.value
    return [
      { label: '待审批领用', value: pendingPartUsages.value.length, type: 'warning', actionPath: '/parts', actionQuery: { tab: 'requests' } },
      { label: '今日新申请', value: todayPartUsageCount.value, type: '', actionPath: '/parts', actionQuery: { tab: 'requests', today: '1' } },
      { label: '库存预警', value: lowStock.length, type: 'danger', actionPath: '/parts', actionQuery: { tab: 'inventory', lowStock: '1' } },
      { label: '备件种类', value: parts.value.length, type: '', actionPath: '/parts', actionQuery: { tab: 'inventory' } },
    ]
  }

  if (userStore.role === 'SERVICE_MANAGER') {
    const superviseCount = workOrders.value.filter((w) => ['CREATED', 'PART_WAITING'].includes(w.status)).length
    const unpaidSettlements = settlements.value.filter((x) => x.paymentStatus === 'UNPAID')
    const dangerBattery = s?.batteryDangerCount ?? batteryAlerts.value.filter((b) => b.warningLevel === 'DANGER').length
    const totalActive = workOrders.value.filter((w) => w.status !== 'CANCELLED').length
    const completionRate = totalActive === 0
      ? '--'
      : `${Math.round((workOrders.value.filter((w) => w.status === 'COMPLETED').length / totalActive) * 100)}%`
    return [
      { label: '待督办工单', value: superviseCount, type: 'danger', actionPath: '/work-order', actionQuery: { scope: 'supervise' } },
      { label: '待收款结算', value: unpaidSettlements.length, type: 'warning', actionPath: '/settlement', actionQuery: { paymentStatus: 'UNPAID' } },
      { label: '电池异常车辆', value: dangerBattery, type: 'danger', actionPath: '/battery', actionQuery: { level: 'DANGER' } },
      { label: '工单完工率', value: completionRate, type: 'success', actionPath: '/work-order', actionQuery: { scope: 'completed' } },
    ]
  }

  if (userStore.role === 'ADMIN') {
    const monthOrders = workOrders.value.filter((w) => isThisMonth(w.createdAt))
    return [
      { label: '本月维修工单', value: monthOrders.length, type: '', actionPath: '/work-order', actionQuery: { scope: 'month' } },
      { label: '待处理预约', value: s?.appointmentPending ?? appointments.value.filter((a) => a.status === 'PENDING').length, type: 'warning', actionPath: '/appointment', actionQuery: { status: 'PENDING' } },
      { label: '电池异常车辆', value: s?.batteryDangerCount ?? 0, type: 'danger', actionPath: '/battery', actionQuery: { level: 'DANGER' } },
      { label: '在修工单', value: s?.workOrderInProgress ?? workOrders.value.filter((w) => ['ASSIGNED', 'IN_PROGRESS', 'PART_WAITING'].includes(w.status)).length, type: '', actionPath: '/work-order', actionQuery: { scope: 'inProgress' } },
    ]
  }

  return []
})

const orderStatusOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: ['待派工', '已派工', '维修中', '待备件', '已完工'] },
  yAxis: { type: 'value' },
  series: [{
    name: '工单数',
    type: 'bar',
    data: [
      workOrders.value.filter((w) => w.status === 'CREATED').length,
      workOrders.value.filter((w) => w.status === 'ASSIGNED').length,
      workOrders.value.filter((w) => w.status === 'IN_PROGRESS').length,
      workOrders.value.filter((w) => w.status === 'PART_WAITING').length,
      workOrders.value.filter((w) => w.status === 'COMPLETED').length,
    ],
    itemStyle: { color: '#e60012' },
  }],
}))

const faultPieOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['40%', '65%'],
    data: [
      { name: '低', value: faults.value.filter((f) => f.faultLevel === 'LOW').length },
      { name: '中', value: faults.value.filter((f) => f.faultLevel === 'MEDIUM').length },
      { name: '高', value: faults.value.filter((f) => f.faultLevel === 'HIGH').length },
      { name: '紧急', value: faults.value.filter((f) => f.faultLevel === 'CRITICAL').length },
    ],
  }],
}))

const partsStockOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 100, right: 20, top: 10, bottom: 30 },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: parts.value.map((p) => p.partName).reverse() },
  series: [{ type: 'bar', data: parts.value.map((p) => p.stockQuantity).reverse(), itemStyle: { color: '#00a651' } }],
}))

function go(path: string) {
  router.push(path)
}

function goKpi(kpi: KpiItem) {
  if (!kpi.actionPath) return
  if (kpi.actionQuery && Object.keys(kpi.actionQuery).length > 0) {
    router.push({ path: kpi.actionPath, query: kpi.actionQuery })
    return
  }
  go(kpi.actionPath)
}

async function confirmAppointment(row: Appointment) {
  await appointmentApi.updateStatus(row.appointmentNo, 'CONFIRMED')
  const [aps, s] = await Promise.all([appointmentApi.list(), dashboardApi.stats()])
  appointments.value = aps || []
  stats.value = s
}

async function approvePartUsage(row: PartUsageRecord, approved: boolean) {
  if (approved && partUsageStockInsufficient(row)) {
    ElMessage.warning('当前库存不足，请先入库或驳回申请')
    return
  }
  const action = approved
    ? partUsageApi.approve(row.usageId, userStore.userId)
    : partUsageApi.reject(row.usageId, userStore.userId)
  await action
  ElMessage.success(approved ? '审批通过' : '已驳回申请')
  pendingPartUsages.value = (await partUsageApi.listPending()) || []
}

onMounted(async () => {
  const [s, ws, aps, bs, ps, fs, sts, usages, todayStats, alerts] = await Promise.all([
    dashboardApi.stats(),
    workOrderApi.list(),
    appointmentApi.list(),
    batteryApi.list(),
    partsApi.list(),
    faultApi.list(),
    settlementApi.list(),
    partUsageApi.listPending(),
    partUsageApi.countToday().catch(() => ({ todayApplications: 0 })),
    partsApi.lowStockAlerts(),
  ])
  lowStockAlerts.value = alerts || []
  stats.value = s
  workOrders.value = ws || []
  appointments.value = aps || []
  batteryAlerts.value = bs || []
  parts.value = ps || []
  faults.value = fs || []
  settlements.value = sts || []
  pendingPartUsages.value = usages || []
  todayPartUsageCount.value = todayStats?.todayApplications ?? 0
  if (userStore.role === 'TECHNICIAN') {
    const logs = await workOrderApi.listSupervisions(userStore.userId)
    supervisionByOrderId.value = buildSupervisionMap(logs || [])
  }
  if (userStore.isOwner && ownerId.value) {
    ownerReminders.value = await reminderApi.listByOwner(ownerId.value)
  }
  if (userStore.role === 'PART_ADMIN') {
    const users = await userApi.list()
    technicians.value = (users || [])
      .filter((u) => u.role === 'TECHNICIAN')
      .map((u) => ({ userId: u.userId as number, realName: u.realName }))
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader :title="config.title" :subtitle="config.subtitle" />

    <el-row :gutter="16" class="kpi-row">
      <el-col v-for="(kpi, i) in kpis" :key="i" :span="6">
        <div class="kpi-card" :class="[kpi.type, { clickable: kpi.actionPath }]" @click="goKpi(kpi)">
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-value">{{ kpi.value }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 车主专属：我的爱车概览 -->
    <template v-if="config.showOwnerPanel && scopedVehicles.length">
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="page-card owner-car-card clickable-card" @click="go('/vehicle')">
            <h3>我的爱车</h3>
            <p class="car-model">{{ scopedVehicles[0]?.model }}</p>
            <p class="car-plate">{{ scopedVehicles[0]?.licensePlate }}</p>
            <el-button type="primary" plain size="small" @click="go('/vehicle')">查看全部 {{ scopedVehicles.length }} 辆</el-button>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="page-card clickable-card" @click="go('/battery')">
            <h3>车辆健康</h3>
            <div class="soh-value">{{ latestOwnerBattery?.soh ?? '--' }}%</div>
            <el-tag :type="batteryStatusType(latestOwnerBattery)" size="small">
              {{ batteryStatusText(latestOwnerBattery) }}
            </el-tag>
            <p class="health-hint">
              {{ latestOwnerBattery && latestOwnerBattery.warningLevel !== 'NORMAL' ? '建议预约电池检测' : '最新电池 SOH 摘要' }}
            </p>
            <el-button link type="primary" @click="go('/battery')">查看车辆健康</el-button>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="page-card clickable-card" @click="go('/appointment')">
            <h3>最近预约</h3>
            <div v-for="a in ownerRecentAppointments.slice(0, 2)" :key="a.appointmentNo" class="mini-item">
              <span>{{ a.appointmentTime }}</span>
              <el-tag :type="serviceTypeConfig(a.serviceType).type" size="small">{{ serviceTypeConfig(a.serviceType).label }}</el-tag>
              <StatusTag :status="a.status" />
            </div>
            <el-button link type="primary" @click="go('/appointment')">全部预约</el-button>
          </div>
        </el-col>
      </el-row>

      <div class="page-card" style="margin-top: 16px">
        <h3>待处理提醒</h3>
        <el-row :gutter="12" class="reminder-list">
          <el-col v-for="item in unreadReminders.slice(0, 4)" :key="item.reminderId" :span="12">
            <div class="reminder-card" :class="item.level.toLowerCase()">
              <div class="reminder-card-head">
                <el-tag :type="reminderType(item)" size="small">{{ reminderLabel(item) }}</el-tag>
                <el-button link type="primary" size="small" @click="markReminderRead(item)">标记已读</el-button>
              </div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.content }}</p>
            </div>
          </el-col>
        </el-row>
        <el-empty v-if="unreadReminders.length === 0" description="暂无待处理提醒" />
      </div>

      <div class="page-card" style="margin-top: 16px">
        <h3>我的维修进度</h3>
        <el-table :data="myWorkOrders" stripe size="small" style="margin-top: 12px">
          <el-table-column prop="workOrderNo" label="工单号" width="150" />
          <el-table-column prop="faultType" label="故障现象" />
          <el-table-column label="进度" width="140">
            <template #default="{ row }">
              <el-progress :percentage="getWorkOrderProgress(row.status)" :stroke-width="6" color="#e60012" />
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <StatusTag :status="row.status" :map="workOrderStatusMap" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 技师工作台 -->
    <template v-else-if="userStore.role === 'TECHNICIAN'">
      <div class="page-card">
        <h3>我的维修任务</h3>
        <el-table :data="myWorkOrders" stripe size="small" style="margin-top: 12px">
          <el-table-column prop="workOrderNo" label="工单号" width="150" />
          <el-table-column prop="vin" label="VIN" width="180" />
          <el-table-column prop="faultType" label="故障现象" />
          <el-table-column label="督办" min-width="140">
            <template #default="{ row }">
              <template v-if="supervisionOf(row.workOrderId)">
                <el-tag type="danger" size="small">经理督办</el-tag>
                <div class="supervise-detail">{{ supervisionOf(row.workOrderId)?.detail }}</div>
              </template>
              <span v-else class="text-muted">无督办</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170">
            <template #default="{ row }">
              <el-button link type="primary" @click="go(`/work-order/${row.workOrderId}`)">处理</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 备件管理员 -->
    <template v-else-if="userStore.role === 'PART_ADMIN'">
      <div class="page-card">
        <div class="panel-head">
          <h3>待审批领用 <el-tag type="warning" size="small">{{ pendingPartUsages.length }}</el-tag></h3>
          <el-button link type="primary" @click="go('/parts?tab=requests')">全部申请</el-button>
        </div>
        <el-alert
          title="技师提交备件申请后由备件员审批；审批通过后，工单完工时将自动扣减库存。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 12px 0"
        />
        <el-table :data="pendingPartUsages" stripe size="small" max-height="320">
          <el-table-column prop="workOrderId" label="工单" width="90" />
          <el-table-column label="备件" min-width="140">
            <template #default="{ row }">
              {{ partMap[row.partId]?.partName || `备件#${row.partId}` }}
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="申请" width="70" />
          <el-table-column label="库存" width="90">
            <template #default="{ row }">
              <span :class="{ 'text-danger': partUsageStockInsufficient(row) }">
                {{ partMap[row.partId]?.stockQuantity ?? '--' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="技师" width="90">
            <template #default="{ row }">
              {{ technicianMap[row.technicianId] || `#${row.technicianId}` }}
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="申请时间" width="150" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="success" size="small" :disabled="partUsageStockInsufficient(row)" @click="approvePartUsage(row, true)">通过</el-button>
              <el-button link type="danger" size="small" @click="approvePartUsage(row, false)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!pendingPartUsages.length" description="暂无待审批领用" />
      </div>
      <el-row :gutter="16" style="margin-top: 16px">
        <el-col :span="14">
          <div class="page-card chart-card" v-if="config.showPartsStockBar">
            <h3>备件库存排行</h3>
            <VChart :option="partsStockOption" style="height: 280px" autoresize />
          </div>
        </el-col>
        <el-col :span="10">
          <div class="page-card">
            <h3>库存预警</h3>
            <el-table :data="lowStockParts" stripe size="small" style="margin-top: 12px" max-height="280">
              <el-table-column prop="partName" label="备件" />
              <el-table-column prop="stockQuantity" label="库存" width="70" />
              <el-table-column prop="warningThreshold" label="阈值" width="70" />
            </el-table>
            <el-button link type="primary" style="margin-top: 8px" @click="go('/parts?tab=inventory&lowStock=1')">查看全部预警</el-button>
          </div>
        </el-col>
      </el-row>
    </template>

    <!-- 服务经理：督办工作台 -->
    <template v-if="config.showManagerPanel">
      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="14">
          <div class="page-card">
            <h3>异常督办待办 <el-tag type="danger" size="small">{{ managerTodos.length }}</el-tag></h3>
            <el-table :data="managerTodos" stripe size="small" style="margin-top: 12px" max-height="320">
              <el-table-column label="优先级" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.priority === 'HIGH' ? 'danger' : row.priority === 'MEDIUM' ? 'warning' : 'info'" size="small">
                    {{ row.priority === 'HIGH' ? '高' : row.priority === 'MEDIUM' ? '中' : '低' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="title" label="事项" min-width="200" />
              <el-table-column prop="desc" label="详情" show-overflow-tooltip />
              <el-table-column label="操作" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="row.actionPath" link type="primary" size="small" @click="go(row.actionPath)">
                    {{ row.actionLabel }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-col>
        <el-col :span="10">
          <div class="page-card">
            <h3>技师在修工单数</h3>
            <el-table :data="technicianWorkload" stripe size="small" style="margin-top: 12px">
              <el-table-column prop="technicianName" label="技师" width="120" />
              <el-table-column label="在修" width="60">
                <template #default="{ row }">{{ row.activeOrders || 0 }}</template>
              </el-table-column>
              <el-table-column prop="activeOrders" label="当前在修" width="90" />
              <el-table-column label="参考负荷" width="100">
                <template #default="{ row }">
                  <el-progress
                    :percentage="Math.min(100, Number((row.activeOrders || 0) * 25))"
                    :stroke-width="6"
                    :color="(row.activeOrders || 0) > 3 ? '#ff4d4f' : (row.activeOrders || 0) > 2 ? '#faad14' : '#00a651'"
                  />
                </template>
              </el-table-column>
            </el-table>
            <p class="manager-hint">参考负荷按每名技师 4 个活跃工单估算，仅作排班参考</p>
          </div>
        </el-col>
      </el-row>
    </template>

    <!-- 经理/管理员：运营统计图表（备件员已在上方专属区展示库存排行，此处不再重复） -->
    <template v-if="config.showOrderStatusChart || config.showFaultPie || (config.showPartsStockBar && userStore.role !== 'PART_ADMIN')">
      <el-row v-if="config.showOrderStatusChart || config.showFaultPie" :gutter="16">
        <el-col v-if="config.showOrderStatusChart" :span="12">
          <div class="page-card chart-card">
            <h3>维修工单状态分布</h3>
            <VChart :option="orderStatusOption" style="height: 300px" autoresize />
          </div>
        </el-col>
        <el-col v-if="config.showFaultPie" :span="12">
          <div class="page-card chart-card">
            <h3>故障等级分布</h3>
            <VChart :option="faultPieOption" style="height: 300px" autoresize />
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="16" style="margin-top: 16px">
        <el-col v-if="config.showPartsStockBar && userStore.role !== 'PART_ADMIN'" :span="12">
          <div class="page-card chart-card">
            <h3>备件库存排行</h3>
            <VChart :option="partsStockOption" style="height: 280px" autoresize />
          </div>
        </el-col>
        <el-col v-if="config.showFaultTable" :span="12">
          <div class="page-card">
            <h3>最近故障登记</h3>
            <el-table :data="recentFaultRows" stripe size="small" style="margin-top: 12px">
              <el-table-column prop="faultNo" label="故障单号" width="150" />
              <el-table-column label="车辆" width="160">
                <template #default="{ row }">
                  <strong>{{ row.licensePlate }}</strong>
                  <div class="text-muted">{{ row.model }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="ownerName" label="车主" width="90" />
              <el-table-column label="顾问判断" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ faultAdvisorJudgment(row) }}</template>
              </el-table-column>
              <el-table-column label="登记顾问" width="90">
                <template #default="{ row }">{{ row.advisorName || '—' }}</template>
              </el-table-column>
              <el-table-column label="等级" width="90">
                <template #default="{ row }">
                  <el-tag :type="faultLevelType(row.faultLevel)" size="small">{{ faultLevelText(row.faultLevel) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="登记时间" width="150" />
            </el-table>
          </div>
        </el-col>
      </el-row>
    </template>

    <!-- 顾问：待办列表 -->
    <template v-if="userStore.role === 'ADVISOR'">
      <el-row :gutter="16" style="margin-top: 16px">
        <el-col :span="12">
          <div class="page-card">
            <h3>待确认预约</h3>
            <el-table :data="myAppointments" stripe size="small">
              <el-table-column prop="ownerName" label="车主" width="80" />
              <el-table-column label="类型" width="90">
                <template #default="{ row }">
                  <el-tag :type="serviceTypeConfig(row.serviceType).type" size="small">
                    {{ serviceTypeConfig(row.serviceType).label }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="appointmentTime" label="时间" />
              <el-table-column label="操作" width="80">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="confirmAppointment(row)">确认</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="page-card chart-card">
            <h3>故障等级分布</h3>
            <VChart :option="faultPieOption" style="height: 240px" autoresize />
          </div>
        </el-col>
      </el-row>
      <div class="page-card" style="margin-top: 16px">
        <h3>最近故障登记</h3>
        <el-table :data="recentFaultRows" stripe size="small" style="margin-top: 12px">
          <el-table-column prop="faultNo" label="故障单号" width="150" />
          <el-table-column label="车辆" width="160">
            <template #default="{ row }">
              <strong>{{ row.licensePlate }}</strong>
              <div class="text-muted">{{ row.model }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="ownerName" label="车主" width="90" />
          <el-table-column label="顾问判断" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ faultAdvisorJudgment(row) }}</template>
          </el-table-column>
          <el-table-column label="登记顾问" width="90">
            <template #default="{ row }">{{ row.advisorName || '—' }}</template>
          </el-table-column>
          <el-table-column label="等级" width="90">
            <template #default="{ row }">
              <el-tag :type="faultLevelType(row.faultLevel)" size="small">{{ faultLevelText(row.faultLevel) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="登记时间" width="150" />
        </el-table>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.chart-card h3,
.page-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h3 {
    margin-bottom: 0;
  }
}

.text-danger {
  color: #ff4d4f;
  font-weight: 600;
}

.owner-car-card {
  .car-model {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 8px 0 4px;
  }

  .car-plate {
    color: #e60012;
    font-weight: 600;
    margin-bottom: 12px;
  }
}

.soh-value {
  font-size: 36px;
  font-weight: 700;
  color: #e60012;
  margin: 8px 0;
}

.health-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #8c8c8c;
}

.reminder-list {
  margin-top: 8px;
}

.reminder-card {
  min-height: 96px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  background: #fafafa;

  .reminder-card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  strong {
    display: block;
    margin: 8px 0 4px;
    font-size: 14px;
  }

  p {
    margin: 0;
    color: #606266;
    font-size: 12px;
    line-height: 1.5;
  }

  &.danger {
    border-color: #ffccc7;
    background: #fff7f6;
  }

  &.warning {
    border-color: #ffe58f;
    background: #fffbe6;
  }
}

.mini-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.kpi-card.clickable,
.clickable-card {
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
  }
}

.manager-hint {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 12px;
}

.text-muted {
  color: #bfbfbf;
}

.supervise-detail {
  margin-top: 4px;
  font-size: 12px;
  color: #cf1322;
  line-height: 1.4;
}
</style>
