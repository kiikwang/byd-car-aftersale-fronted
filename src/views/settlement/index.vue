<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useUserStore } from '@/stores/user'
import { useOwnerVins, buildVehicleListParams } from '@/composables/useScopedVehicles'
import { usePermissions } from '@/composables/usePermissions'
import { faultApi, settlementApi, vehicleApi, workOrderApi } from '@/api'
import { queryString } from '@/utils/route-filter'
import type { Settlement, Vehicle } from '@/types'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const ownerVins = useOwnerVins()
const { can, isServiceManager } = usePermissions()

const tableData = ref<Settlement[]>([])
const orderVinMap = ref<Record<number, string>>({})
const vehicleMap = ref<Record<string, Vehicle>>({})

const scopedData = computed(() => {
  let list = tableData.value
  if (userStore.isOwner) {
    list = list.filter((s) => ownerVins.value.includes(s.vin) && s.managerStatus === 'APPROVED')
  }
  return list
})

const filterPaymentStatus = computed(() => queryString(route.query.paymentStatus))
const hasRouteFilter = computed(() => Boolean(filterPaymentStatus.value))

const displayData = computed(() => {
  const base = isServiceManager.value ? tableData.value : scopedData.value
  if (!filterPaymentStatus.value) return base
  return base.filter((s) => s.paymentStatus === filterPaymentStatus.value)
})

function clearRouteFilters() {
  router.replace({ path: '/settlement' })
}

const detailVisible = ref(false)
const current = ref<Settlement | null>(null)

const settlementGross = computed(() => {
  if (!current.value) return 0
  const labor = Number(current.value.laborAmount) || 0
  const part = Number(current.value.partAmount) || 0
  return labor + part
})

const managerStatusMap = {
  PENDING_APPROVAL: { label: '待经理审核', type: 'warning' as const },
  APPROVED: { label: '已审核', type: 'success' as const },
  REJECTED: { label: '已驳回', type: 'danger' as const },
}

function viewDetail(row: Settlement) {
  current.value = row
  detailVisible.value = true
}

async function markPaid(row: Settlement) {
  if (!row.settlementId) return
  if (userStore.isOwner) {
    try {
      await ElMessageBox.prompt('请输入 6 位支付密码完成支付', '账单支付', {
        confirmButtonText: '确认支付',
        cancelButtonText: '取消',
        inputPattern: /^\d{6}$/,
        inputErrorMessage: '请输入 6 位数字支付密码',
        inputType: 'password',
      })
    } catch {
      return
    }
  }
  await settlementApi.pay(row.settlementId)
  ElMessage.success(userStore.isOwner ? '支付成功' : '收款已确认')
  await loadData()
}

const pendingReviewCount = computed(
  () => tableData.value.filter((s) => s.managerStatus === 'PENDING_APPROVAL').length,
)

async function approveSettlement(row: Settlement) {
  if (!row.settlementId) return
  await settlementApi.approve(row.settlementId, userStore.userId)
  ElMessage.success('审核通过')
  await loadData()
}

async function rejectSettlement(row: Settlement) {
  if (!row.settlementId) return
  await settlementApi.reject(row.settlementId, userStore.userId)
  ElMessage.warning('已驳回')
  await loadData()
}

async function loadData() {
  const [settlements, workOrders, faults, vehicles] = await Promise.all([
    settlementApi.list(),
    workOrderApi.list(),
    faultApi.list(),
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
  ])
  vehicleMap.value = Object.fromEntries((vehicles || []).map((v) => [v.vin, v]))
  const faultVin = Object.fromEntries((faults || []).filter((f: any) => f.faultId).map((f: any) => [f.faultId as number, f.vin]))
  orderVinMap.value = Object.fromEntries((workOrders || []).filter((w: any) => w.workOrderId).map((w: any) => [w.workOrderId as number, faultVin[w.faultId || 0] || w.vin || '']))
  tableData.value = (settlements || []).map((s: any) => {
    const vin = orderVinMap.value[s.workOrderId] || '-'
    const vehicle = vehicleMap.value[vin]
    return {
      ...s,
      vin,
      ownerName: vehicle?.ownerName || s.ownerName || '-',
      ownerPhone: vehicle?.ownerPhone || '',
      licensePlate: vehicle?.licensePlate || '-',
      model: vehicle?.model || '-',
    }
  })
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <PageHeader
      :title="userStore.isOwner ? '我的维修结算' : isServiceManager ? '结算审核' : '维修结算'"
      :subtitle="userStore.isOwner ? '仅显示经理已审核的账单' : isServiceManager ? `待审核 ${pendingReviewCount} 笔 · 大额/质保外费用把关` : '顾问生成结算单并提交经理审核，收款由车主支付后生效'"
    >
      <template #actions />
    </PageHeader>

    <div class="page-card">
      <el-alert
        v-if="hasRouteFilter"
        :title="`看板筛选：待收款结算（共 ${displayData.length} 条）`"
        type="info"
        show-icon
        closable
        style="margin-bottom: 12px"
        @close="clearRouteFilters"
      />
      <el-table :data="displayData" stripe>
        <el-table-column prop="settlementNo" label="结算单号" width="150" />
        <el-table-column v-if="!userStore.isOwner" label="车主" width="150">
          <template #default="{ row }">
            <strong>{{ row.ownerName }}</strong>
            <div class="sub-text">{{ row.ownerPhone || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="车辆" width="170">
          <template #default="{ row }">
            <strong>{{ row.licensePlate }}</strong>
            <div class="sub-text">{{ row.model }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="workOrderId" label="关联工单" width="100" />
        <el-table-column prop="vin" label="VIN" width="180" show-overflow-tooltip />
        <el-table-column prop="totalAmount" label="合计(元)" width="100">
          <template #default="{ row }">
            <strong :class="{ 'amount-high': row.totalAmount > 1000 }">¥{{ row.totalAmount }}</strong>
          </template>
        </el-table-column>
        <el-table-column v-if="!userStore.isOwner" label="审核状态" width="110">
          <template #default="{ row }">
            <StatusTag :status="row.managerStatus || 'PENDING_APPROVAL'" :map="managerStatusMap" />
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="row.paymentStatus" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">明细</el-button>
            <el-button
              v-if="can('settlement', 'approveSettlement') && row.managerStatus === 'PENDING_APPROVAL'"
              link
              type="success"
              @click="approveSettlement(row)"
            >通过</el-button>
            <el-button
              v-if="can('settlement', 'approveSettlement') && row.managerStatus === 'PENDING_APPROVAL'"
              link
              type="danger"
              @click="rejectSettlement(row)"
            >驳回</el-button>
            <el-button
              v-if="userStore.isOwner && row.paymentStatus === 'UNPAID' && row.managerStatus === 'APPROVED'"
              link
              type="success"
              @click="markPaid(row)"
            >立即支付</el-button>
            <el-button
              v-if="userStore.role === 'ADMIN' && can('settlement', 'settle') && row.paymentStatus === 'UNPAID' && row.managerStatus === 'APPROVED'"
              link
              type="success"
              @click="markPaid(row)"
            >确认收款</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="detailVisible" title="结算明细" width="480px">
      <template v-if="current">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="结算单号">{{ current.settlementNo }}</el-descriptions-item>
          <el-descriptions-item label="车主">{{ current.ownerName }} {{ (current as any).ownerPhone || '' }}</el-descriptions-item>
          <el-descriptions-item label="车辆">{{ (current as any).licensePlate }} / {{ (current as any).model }}</el-descriptions-item>
          <el-descriptions-item label="VIN">{{ current.vin }}</el-descriptions-item>
          <el-descriptions-item label="人工费">¥{{ current.laborAmount }}</el-descriptions-item>
          <el-descriptions-item label="备件费">¥{{ current.partAmount }}</el-descriptions-item>
          <el-descriptions-item label="费用合计">¥{{ settlementGross }}</el-descriptions-item>
          <el-descriptions-item label="质保内（厂家承担）">¥{{ current.warrantyAmount }}</el-descriptions-item>
          <el-descriptions-item label="客户应付（质保外/自费）">
            <strong style="font-size: 18px; color: #e60012">¥{{ current.totalAmount }}</strong>
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.amount-high { color: #e60012; }
.sub-text {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}
</style>
