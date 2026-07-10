<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useUserStore } from '@/stores/user'
import { useOwnerVins } from '@/composables/useScopedVehicles'
import { usePermissions } from '@/composables/usePermissions'
import { faultApi, userApi, workOrderApi } from '@/api'
import { getWorkOrderProgress } from '@/utils/work-order-progress'
import { buildSupervisionMap, getSupervisionEntry, type SupervisionEntry } from '@/utils/supervision'
import {
  isThisMonth,
  parseStatusList,
  queryString,
  WORK_ORDER_SCOPE_STATUSES,
  workOrderFilterLabel,
} from '@/utils/route-filter'
import type { FaultRecord, SysUser, WorkOrder } from '@/types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const ownerVins = useOwnerVins()
const { isTechnician } = usePermissions()

const rawOrders = ref<WorkOrder[]>([])
const faultMap = ref<Record<number, FaultRecord>>({})
const technicianMap = ref<Record<number, string>>({})
const supervisionByOrderId = ref<Record<number, SupervisionEntry>>({})

function technicianName(technicianId?: number | null) {
  if (!technicianId) return '待派工'
  return technicianMap.value[technicianId] || `技师#${technicianId}`
}

function supervisionOf(workOrderId?: number) {
  return getSupervisionEntry(supervisionByOrderId.value, workOrderId)
}

const tableData = computed(() => {
  let list = rawOrders.value.map((w) => {
    const fault = w.faultId ? faultMap.value[w.faultId] : undefined
    return {
      ...w,
      vin: fault?.vin || w.vin || '',
      faultType: fault?.faultDescription || w.faultType || '-',
      technician: w.technician || technicianName(w.technicianId),
      progress: getWorkOrderProgress(w.status),
    }
  })

  if (userStore.isOwner) {
    list = list.filter((w) => ownerVins.value.includes(w.vin))
  } else if (isTechnician.value) {
    list = list.filter((w) => w.technicianId === userStore.userId)
  }
  return list
})

const workOrderStatusMap = {
  CREATED: { label: '待派工', type: 'warning' as const },
  ASSIGNED: { label: '已派工', type: 'info' as const },
  IN_PROGRESS: { label: '正在维修', type: 'warning' as const },
  PART_WAITING: { label: '待备件', type: 'warning' as const },
  COMPLETED: { label: '维修完成', type: 'success' as const },
  CANCELLED: { label: '已取消', type: 'info' as const },
}

const filterScope = computed(() => queryString(route.query.scope))
const filterStatuses = computed(() => {
  if (filterScope.value && WORK_ORDER_SCOPE_STATUSES[filterScope.value]) {
    return WORK_ORDER_SCOPE_STATUSES[filterScope.value]
  }
  return parseStatusList(queryString(route.query.status))
})
const filterThisMonth = computed(() => filterScope.value === 'month')
const hasRouteFilter = computed(() => filterStatuses.value.length > 0 || filterThisMonth.value)
const routeFilterLabel = computed(() => workOrderFilterLabel(filterScope.value, filterStatuses.value))

const displayedData = computed(() => {
  let list = tableData.value
  if (filterStatuses.value.length) {
    list = list.filter((o) => filterStatuses.value.includes(o.status))
  }
  if (filterThisMonth.value) {
    list = list.filter((o) => isThisMonth(o.createdAt))
  }
  return list
})

function clearRouteFilters() {
  router.replace({ path: '/work-order' })
}

const statusCards = computed(() => {
  if (isTechnician.value) {
    return [
      { className: 'assigned', label: '待开始', count: tableData.value.filter((o) => o.status === 'ASSIGNED').length },
      { className: 'repairing', label: '维修中', count: tableData.value.filter((o) => o.status === 'IN_PROGRESS').length },
      { className: 'pending', label: '待备件', count: tableData.value.filter((o) => o.status === 'PART_WAITING').length },
      { className: 'done', label: '维修完成', count: tableData.value.filter((o) => o.status === 'COMPLETED').length },
    ]
  }
  return [
    { className: 'pending', label: '待派工', count: tableData.value.filter((o) => o.status === 'CREATED').length },
    { className: 'assigned', label: '已派工', count: tableData.value.filter((o) => o.status === 'ASSIGNED').length },
    { className: 'repairing', label: '维修中', count: tableData.value.filter((o) => ['IN_PROGRESS', 'PART_WAITING'].includes(o.status)).length },
    { className: 'done', label: '维修完成', count: tableData.value.filter((o) => o.status === 'COMPLETED').length },
  ]
})

async function loadData() {
  const [orders, faults, users] = await Promise.all([
    workOrderApi.list(),
    faultApi.list(),
    userApi.list(),
  ])
  rawOrders.value = orders || []
  faultMap.value = Object.fromEntries((faults || []).filter((f: any) => f.faultId).map((f: any) => [f.faultId as number, f]))
  technicianMap.value = Object.fromEntries(
    (users || [])
      .filter((u: SysUser) => u.userId)
      .map((u: SysUser) => [u.userId as number, u.realName || u.username]),
  )
  if (isTechnician.value) {
    const logs = await workOrderApi.listSupervisions(userStore.userId)
    supervisionByOrderId.value = buildSupervisionMap(logs || [])
  }
}

onMounted(loadData)
</script>



<template>

  <div class="page-container">

    <PageHeader

      :title="userStore.isOwner ? '我的维修工单' : isTechnician ? '我的维修任务' : '维修工单'"

      :subtitle="userStore.isOwner ? '跟踪本人车辆维修进度' : isTechnician ? '接单、更新进度、申请备件' : '派工与进度管理'"

    />



    <el-row :gutter="16" style="margin-bottom: 16px">

      <el-col v-for="card in statusCards" :key="card.label" :span="6">
        <div class="status-card" :class="card.className">
          <div class="num">{{ card.count }}</div>
          <div class="label">{{ card.label }}</div>
        </div>
      </el-col>

    </el-row>



    <div class="page-card">
      <el-alert
        v-if="hasRouteFilter"
        :title="`看板筛选：${routeFilterLabel}（共 ${displayedData.length} 条）`"
        type="info"
        show-icon
        closable
        style="margin-bottom: 12px"
        @close="clearRouteFilters"
      />
      <el-table :data="displayedData" stripe>

        <el-table-column prop="workOrderNo" label="工单号" width="150" />

        <el-table-column prop="vin" label="VIN" width="180" />

        <el-table-column prop="faultType" label="故障现象" />

        <el-table-column prop="technician" label="技师" width="100" />
        <el-table-column v-if="isTechnician" label="督办" min-width="140">
          <template #default="{ row }">
            <template v-if="supervisionOf(row.workOrderId)">
              <el-tag type="danger" size="small">经理督办</el-tag>
              <div class="supervise-detail">{{ supervisionOf(row.workOrderId)?.detail }}</div>
            </template>
            <span v-else class="text-muted">无督办</span>
          </template>
        </el-table-column>

        <el-table-column label="进度" width="160">

          <template #default="{ row }">

            <el-progress :percentage="row.progress || 0" :stroke-width="8" color="#e60012" />

          </template>

        </el-table-column>

        <el-table-column label="状态" width="110">

          <template #default="{ row }">

            <StatusTag :status="row.status" :map="workOrderStatusMap" />

          </template>

        </el-table-column>

        <el-table-column prop="createdAt" label="创建时间" width="160" />

        <el-table-column label="操作" width="170" fixed="right">

          <template #default="{ row }">

            <el-button link type="primary" @click="router.push(`/work-order/${row.workOrderId}`)">详情</el-button>
            <el-button
              v-if="isTechnician && row.faultId"
              link
              type="success"
              @click="router.push({ path: '/agent', query: { faultId: String(row.faultId), workOrderId: String(row.workOrderId) } })"
            >Agent 诊断</el-button>

          </template>

        </el-table-column>

      </el-table>

    </div>

  </div>

</template>



<style scoped lang="scss">

.status-card {

  background: #fff;

  border-radius: 8px;

  padding: 20px;

  text-align: center;

  border-left: 4px solid #e60012;

  &.pending { border-color: #fa8c16; }

  &.repairing { border-color: #e60012; }

  &.assigned { border-color: #722ed1; }

  &.done { border-color: #00a651; }

  .num { font-size: 28px; font-weight: 600; }

  .label { color: #8c8c8c; font-size: 13px; margin-top: 4px; }

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


