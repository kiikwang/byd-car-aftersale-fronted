<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useUserStore } from '@/stores/user'
import { partUsageApi, partsApi, userApi, workOrderApi } from '@/api'
import { parseLowStockPartIds } from '@/utils/low-stock'
import { isToday, queryString } from '@/utils/route-filter'
import { partCategoryLabel, PART_CATEGORY_OPTIONS } from '@/constants/part-category'
import type { Part, WorkOrder } from '@/types'

const { can, isTechnician, isPartAdmin } = usePermissions()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const activeTab = ref(isPartAdmin.value ? 'requests' : 'inventory')
const requestStatusFilter = ref<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
const todayApplicationCount = ref(0)
type PartRequest = {
  usageId: number
  workOrderId: number
  partId: number
  quantity: number
  technicianId: number
  status: 'PROPOSED' | 'APPLIED' | 'APPROVED' | 'REJECTED' | 'USED' | 'RETURNED'
  createdAt?: string
}
const tableData = ref<Part[]>([])
const requests = ref<PartRequest[]>([])
const technicians = ref<Array<{ userId: number; realName: string }>>([])
const targetPartNo = computed(() => typeof route.query.partNo === 'string' ? route.query.partNo : '')
const filterLowStock = computed(() => route.query.lowStock === '1')
const filterToday = computed(() => route.query.today === '1')

const inventoryData = computed(() => {
  let list = tableData.value
  if (filterLowStock.value) list = list.filter((p) => isLowStock(p))
  return list
})

const requestsData = computed(() => {
  let list = scopedRequests.value
  if (requestStatusFilter.value === 'PENDING') {
    list = list.filter((r) => r.status === 'APPLIED' || r.status === 'PROPOSED')
  } else if (requestStatusFilter.value === 'APPROVED') {
    list = list.filter((r) => r.status === 'APPROVED' || r.status === 'USED')
  } else if (requestStatusFilter.value === 'REJECTED') {
    list = list.filter((r) => r.status === 'REJECTED')
  }
  if (filterToday.value) list = list.filter((r) => isToday(r.createdAt))
  return list
})

function clearRouteFilters() {
  router.replace({ path: '/parts' })
}

const partDialogVisible = ref(false)
const partEditMode = ref(false)
const editingPartId = ref<number | null>(null)
const partForm = ref({
  partNo: '',
  partName: '',
  category: '',
  stockQuantity: 0,
  warningThreshold: 5,
  unit: '个',
  purchasePrice: 0,
  sellingPrice: 0,
})
const stockDialogVisible = ref(false)
const stockForm = ref({ partId: null as number | null, partName: '', quantity: 1 })

const applyDialogVisible = ref(false)
const applyForm = ref({ workOrderId: null as number | null, partNo: '', quantity: 1 })
const myWorkOrders = ref<WorkOrder[]>([])
const lowStockPartIds = ref<Set<number>>(new Set())
const UNIT_OPTIONS = ['个', '套', '块', '桶', '瓶', '升', '件']

function formatPrice(value?: number) {
  if (value === undefined || value === null) return '—'
  return `¥${Number(value).toFixed(2)}`
}

function isLowStock(row: Part) {
  if (row.partId && lowStockPartIds.value.size > 0) {
    return lowStockPartIds.value.has(row.partId)
  }
  return row.stockQuantity < row.warningThreshold
}

function partRowClassName({ row }: { row: Part }) {
  if (targetPartNo.value && row.partNo === targetPartNo.value) return 'target-part-row'
  return isLowStock(row) ? 'low-stock' : ''
}

const pendingCount = computed(() => scopedRequests.value.filter((r) => r.status === 'APPLIED' || r.status === 'PROPOSED').length)
const partMap = computed(() =>
  Object.fromEntries(tableData.value.filter((p) => p.partId).map((p) => [p.partId as number, p])),
)
const technicianMap = computed(() =>
  Object.fromEntries(technicians.value.map((u) => [u.userId, u.realName])),
)

function openPartForm() {
  partEditMode.value = false
  editingPartId.value = null
  partForm.value = {
    partNo: '',
    partName: '',
    category: '',
    stockQuantity: 0,
    warningThreshold: 5,
    unit: '个',
    purchasePrice: 0,
    sellingPrice: 0,
  }
  partDialogVisible.value = true
}

function openEditPart(row: Part) {
  partEditMode.value = true
  editingPartId.value = row.partId || null
  partForm.value = {
    partNo: row.partNo,
    partName: row.partName,
    category: row.category,
    stockQuantity: row.stockQuantity,
    warningThreshold: row.warningThreshold,
    unit: row.unit || '个',
    purchasePrice: row.purchasePrice ?? 0,
    sellingPrice: row.sellingPrice ?? 0,
  }
  partDialogVisible.value = true
}

function savePart() {
  if (!partForm.value.partNo || !partForm.value.partName) {
    ElMessage.warning('请填写备件编码与名称')
    return
  }
  const request = partEditMode.value && editingPartId.value
    ? partsApi.update(editingPartId.value, partForm.value as any)
    : partsApi.create(partForm.value as any)
  request.then(async () => {
    partDialogVisible.value = false
    ElMessage.success(partEditMode.value ? '备件已更新' : '备件已添加')
    await reloadInventory()
  })
}

async function removePart(row: Part) {
  if (!row.partId) return
  await ElMessageBox.confirm(`确认删除备件 ${row.partName}？`, '删除备件', { type: 'warning' })
  await partsApi.remove(row.partId)
  ElMessage.success('备件已删除')
  await reloadInventory()
}

function openAddStock(row: Part) {
  stockForm.value = { partId: row.partId || null, partName: row.partName, quantity: 1 }
  stockDialogVisible.value = true
}

async function submitAddStock() {
  if (!stockForm.value.partId) return
  await partsApi.addStock(stockForm.value.partId, stockForm.value.quantity)
  stockDialogVisible.value = false
  ElMessage.success('库存已入库')
  await reloadInventory()
}

function openApply() {
  applyForm.value = { workOrderId: myWorkOrders.value[0]?.workOrderId ?? null, partNo: '', quantity: 1 }
  applyDialogVisible.value = true
}

function submitApply() {
  if (!applyForm.value.workOrderId) {
    ElMessage.warning('请选择关联工单')
    return
  }
  const part = tableData.value.find((p) => p.partNo === applyForm.value.partNo)
  if (!part) {
    ElMessage.warning('请选择备件')
    return
  }
  partUsageApi.apply({
    workOrderId: applyForm.value.workOrderId,
    partId: part.partId as number,
    quantity: applyForm.value.quantity,
    technicianId: userStore.userId,
  }).then(async () => {
    applyDialogVisible.value = false
    ElMessage.success('备件申请已提交，等待备件员审批')
    await loadRequests()
  })
}

function stockForRequest(row: PartRequest) {
  return partMap.value[row.partId]?.stockQuantity
}

function isStockInsufficient(row: PartRequest) {
  const stock = stockForRequest(row)
  return stock !== undefined && stock < row.quantity
}

function approveRequest(row: PartRequest, approved: boolean) {
  if (approved && isStockInsufficient(row)) {
    ElMessage.warning('当前库存不足，请先入库或驳回申请')
    return
  }
  const action = approved ? partUsageApi.approve(row.usageId, userStore.userId) : partUsageApi.reject(row.usageId, userStore.userId)
  action.then(async () => {
    ElMessage.success(approved ? '审批通过' : '已驳回申请')
    await Promise.all([loadRequests(), reloadInventory()])
  })
}

const scopedRequests = computed(() => {
  if (isTechnician.value) {
    return requests.value.filter((r) => r.technicianId === userStore.userId)
  }
  return requests.value
})

async function reloadInventory() {
  const [parts, alerts] = await Promise.all([partsApi.list(), partsApi.lowStockAlerts()])
  tableData.value = parts || []
  lowStockPartIds.value = new Set(parseLowStockPartIds(alerts || []))
}

onMounted(async () => {
  const tab = queryString(route.query.tab)
  if (tab === 'inventory' || tab === 'requests') {
    activeTab.value = tab
  } else if (targetPartNo.value || filterLowStock.value) {
    activeTab.value = 'inventory'
  } else if (filterToday.value || isPartAdmin.value) {
    activeTab.value = 'requests'
  }
  await reloadInventory()
  const users = await userApi.list()
  technicians.value = (users || [])
    .filter((u) => u.role === 'TECHNICIAN')
    .map((u) => ({ userId: u.userId as number, realName: u.realName }))
  if (isTechnician.value) {
    myWorkOrders.value = await workOrderApi.listMine(userStore.userId)
  }
  await loadRequests()
})

async function loadRequests() {
  const [all, stats] = await Promise.all([
    partUsageApi.listAll(),
    partUsageApi.countToday().catch(() => ({ todayApplications: 0 })),
  ])
  requests.value = (all || []) as any
  todayApplicationCount.value = stats?.todayApplications ?? requests.value.filter((r) => isToday(r.createdAt)).length
}
</script>

<template>
  <div class="page-container">
    <PageHeader
      :title="isPartAdmin ? '备件管理与领用审批' : isTechnician ? '备件申请' : '备件库存'"
      :subtitle="isPartAdmin ? '审批技师领用申请，维护备件库存与预警' : isTechnician ? '提交备件申请，由备件员审批后发料' : '备件库存与预警管理'"
    >
      <template #actions>
        <el-button v-if="can('parts', 'create')" type="primary" @click="openPartForm">新增备件</el-button>
        <el-button v-if="can('parts', 'applyPart')" type="primary" @click="openApply">申请备件</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab">
      <el-tab-pane v-if="can('parts', 'applyPart') || can('parts', 'approvePart')" :label="`领用审批${pendingCount ? ` (${pendingCount})` : ''}`" name="requests">
        <div class="page-card">
          <el-alert
            v-if="isPartAdmin"
            title="领用审批流程：技师申请 → 备件员审批 → 工单完工扣库存"
            type="info"
            show-icon
            :closable="false"
            style="margin-bottom: 12px"
          />
          <div v-if="isPartAdmin" style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
            <el-radio-group v-model="requestStatusFilter" size="small">
              <el-radio-button value="ALL">全部</el-radio-button>
              <el-radio-button value="PENDING">待审批</el-radio-button>
              <el-radio-button value="APPROVED">已审批</el-radio-button>
              <el-radio-button value="REJECTED">已驳回</el-radio-button>
            </el-radio-group>
            <el-tag type="info">今日新申请 {{ todayApplicationCount }} 条</el-tag>
          </div>
          <el-alert
            v-if="filterToday"
            :title="`看板筛选：今日新申请（共 ${todayApplicationCount} 条）`"
            type="info"
            show-icon
            closable
            style="margin-bottom: 12px"
            @close="clearRouteFilters"
          />
          <el-table :data="requestsData" stripe>
            <el-table-column prop="usageId" label="申请ID" width="110" />
            <el-table-column prop="workOrderId" label="关联工单" width="120" />
            <el-table-column label="备件" min-width="160">
              <template #default="{ row }">
                {{ partMap[row.partId]?.partName || `备件#${row.partId}` }}
                <span v-if="partMap[row.partId]?.partNo" class="text-muted">（{{ partMap[row.partId]?.partNo }}）</span>
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="申请数量" width="90" />
            <el-table-column v-if="can('parts', 'approvePart')" label="当前库存" width="120">
              <template #default="{ row }">
                <span :class="{ 'text-danger': isStockInsufficient(row) }">
                  {{ stockForRequest(row) ?? '--' }}
                </span>
                <el-tag v-if="isStockInsufficient(row)" type="danger" size="small" style="margin-left: 4px">不足</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="申请人" width="120">
              <template #default="{ row }">
                {{ technicianMap[row.technicianId] || `技师#${row.technicianId}` }}
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="申请时间" width="160" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <StatusTag :status="row.status" />
              </template>
            </el-table-column>
            <el-table-column v-if="can('parts', 'approvePart')" label="备件员审批" width="160" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status === 'APPLIED' || row.status === 'PROPOSED'">
                  <el-button link type="success" :disabled="isStockInsufficient(row)" @click="approveRequest(row, true)">通过</el-button>
                  <el-button link type="danger" @click="approveRequest(row, false)">驳回</el-button>
                </template>
                <span v-else class="text-muted">已处理</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!requestsData.length" :description="isPartAdmin ? '暂无领用申请记录' : '暂无申请记录'" />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="can('parts', 'view')" label="库存列表" name="inventory">
        <div class="page-card">
          <el-alert
            v-if="targetPartNo || filterLowStock"
            :title="targetPartNo ? `已定位备件：${targetPartNo}` : `看板筛选：库存预警（共 ${inventoryData.length} 条）`"
            type="warning"
            show-icon
            :closable="Boolean(targetPartNo || filterLowStock)"
            style="margin-bottom: 12px"
            @close="clearRouteFilters"
          />
          <el-table :data="inventoryData" stripe :row-class-name="partRowClassName">
            <el-table-column prop="partNo" label="备件编码" width="140" />
            <el-table-column prop="partName" label="备件名称" />
            <el-table-column label="分类" width="110">
              <template #default="{ row }">{{ partCategoryLabel(row.category) }}</template>
            </el-table-column>
            <el-table-column prop="stockQuantity" label="当前库存" width="110">
              <template #default="{ row }">
                <span :class="{ 'text-danger': isLowStock(row) }">{{ row.stockQuantity }}</span>
                <el-tag v-if="isLowStock(row)" type="danger" size="small" style="margin-left: 6px">预警</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="warningThreshold" label="预警阈值" width="100" />
            <el-table-column prop="unit" label="单位" width="70" />
            <el-table-column label="单价" width="110" align="right">
              <template #default="{ row }">{{ formatPrice(row.sellingPrice) }}</template>
            </el-table-column>
            <el-table-column v-if="can('parts', 'edit') || can('parts', 'delete')" label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button v-if="can('parts', 'edit')" link type="primary" @click="openEditPart(row)">编辑</el-button>
                <el-button v-if="can('parts', 'edit')" link type="success" @click="openAddStock(row)">入库</el-button>
                <el-button v-if="can('parts', 'delete')" link type="danger" @click="removePart(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

    </el-tabs>

    <el-dialog v-model="partDialogVisible" :title="partEditMode ? '编辑备件' : '新增备件'" width="480px">
      <el-form :model="partForm" label-width="100px">
        <el-form-item label="备件编码"><el-input v-model="partForm.partNo" :disabled="partEditMode" /></el-form-item>
        <el-form-item label="备件名称"><el-input v-model="partForm.partName" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="partForm.category" placeholder="选择分类" style="width: 100%">
            <el-option
              v-for="item in PART_CATEGORY_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库存"><el-input-number v-model="partForm.stockQuantity" :min="0" :disabled="partEditMode" /></el-form-item>
        <el-form-item label="预警阈值"><el-input-number v-model="partForm.warningThreshold" :min="1" /></el-form-item>
        <el-form-item label="单位">
          <el-select v-model="partForm.unit" style="width: 100%">
            <el-option v-for="u in UNIT_OPTIONS" :key="u" :label="u" :value="u" />
          </el-select>
        </el-form-item>
        <el-form-item label="采购价">
          <el-input-number v-model="partForm.purchasePrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="销售单价">
          <el-input-number v-model="partForm.sellingPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="partDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePart">{{ partEditMode ? '更新' : '保存' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="stockDialogVisible" title="备件入库" width="420px">
      <el-form :model="stockForm" label-width="90px">
        <el-form-item label="备件名称">
          <el-input v-model="stockForm.partName" disabled />
        </el-form-item>
        <el-form-item label="入库数量">
          <el-input-number v-model="stockForm.quantity" :min="1" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAddStock">确认入库</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="applyDialogVisible" title="备件申请" width="440px">
      <el-form :model="applyForm" label-width="90px">
        <el-form-item label="关联工单">
          <el-select v-model="applyForm.workOrderId" placeholder="选择工单" style="width: 100%">
            <el-option
              v-for="wo in myWorkOrders"
              :key="wo.workOrderId"
              :label="wo.workOrderNo"
              :value="wo.workOrderId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备件">
          <el-select v-model="applyForm.partNo" placeholder="选择备件" style="width: 100%">
            <el-option v-for="p in tableData" :key="p.partNo" :label="`${p.partName} (库存${p.stockQuantity})`" :value="p.partNo" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="applyForm.quantity" :min="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="applyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApply">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.text-danger { color: #ff4d4f; font-weight: 600; }
.text-muted { color: #8c8c8c; font-size: 13px; }
:deep(.low-stock) { background-color: #fff0f1 !important; }
:deep(.target-part-row td) {
  background-color: #fff1f0 !important;
}
:deep(.target-part-row td:first-child) {
  border-left: 4px solid #e60012;
}
</style>
