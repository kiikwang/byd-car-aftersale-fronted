<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useUserStore } from '@/stores/user'
import { buildVehicleListParams } from '@/composables/useScopedVehicles'
import { faultApi, vehicleApi, workOrderApi, userApi } from '@/api'
import { faultFilterLabel, parseStatusList, queryString } from '@/utils/route-filter'
import { parseFaultDescription, buildFaultDescription, FAULT_TYPE_OPTIONS, FAULT_QUICK_TAGS } from '@/utils/fault-form'
import type { FaultRecord, SysUser, Vehicle, WorkOrder } from '@/types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const { can } = usePermissions()
const tableData = ref<FaultRecord[]>([])
const workOrders = ref<WorkOrder[]>([])
const vehicles = ref<Vehicle[]>([])
const advisors = ref<SysUser[]>([])
const dialogVisible = ref(false)
const editMode = ref(false)
const editingFaultNo = ref('')
const form = ref({
  vin: '',
  faultType: '',
  ownerDescription: '',
  advisorJudgment: '',
  faultLevel: 'MEDIUM' as FaultRecord['faultLevel'],
})
const faultTypeOptions = [...FAULT_TYPE_OPTIONS]
const quickTags = [...FAULT_QUICK_TAGS]

const filterStatuses = computed(() => parseStatusList(queryString(route.query.status)))
const hasRouteFilter = computed(() => filterStatuses.value.length > 0)
const routeFilterLabel = computed(() => faultFilterLabel(filterStatuses.value))
const vehicleMap = computed(() =>
  Object.fromEntries(vehicles.value.map((v) => [v.vin, v])),
)
const advisorMap = computed(() =>
  Object.fromEntries(advisors.value.map((u) => [u.userId, u.realName])),
)
const workOrderMap = computed(() =>
  Object.fromEntries(
    workOrders.value
      .filter((wo) => wo.faultId)
      .map((wo) => [wo.faultId as number, wo]),
  ),
)
const displayRows = computed(() =>
  tableData.value.map((fault) => {
    const vehicle = vehicleMap.value[fault.vin]
    return {
      ...fault,
      ownerName: fault.ownerName || vehicle?.ownerName || '—',
      licensePlate: fault.licensePlate || vehicle?.licensePlate || '—',
      model: fault.model || vehicle?.model || '—',
      advisorName: fault.advisorName || advisorMap.value[fault.advisorId || 0] || '—',
    }
  }),
)
const filteredData = computed(() => {
  if (!filterStatuses.value.length) return displayRows.value
  return displayRows.value.filter((f) => filterStatuses.value.includes(f.status))
})

function clearRouteFilters() {
  router.replace({ path: '/fault' })
}

function openCreate() {
  editMode.value = false
  editingFaultNo.value = ''
  form.value = {
    vin: '',
    faultType: '',
    ownerDescription: '',
    advisorJudgment: '',
    faultLevel: 'MEDIUM',
  }
  dialogVisible.value = true
}

function openEdit(row: FaultRecord) {
  const parsed = parseFaultDescription(row.faultDescription)
  editMode.value = true
  editingFaultNo.value = row.faultNo
  form.value = {
    vin: row.vin,
    faultType: parsed.faultType || row.faultType || '其他',
    ownerDescription: parsed.ownerDescription || '',
    advisorJudgment: parsed.advisorJudgment || '',
    faultLevel: row.faultLevel,
  }
  dialogVisible.value = true
}

function addQuickTag(tag: string) {
  form.value.faultType = tag
  if (!form.value.advisorJudgment.includes(tag)) {
    form.value.advisorJudgment = form.value.advisorJudgment
      ? `${form.value.advisorJudgment}；${tag}`
      : tag
  }
}

function submitForm() {
  if (!form.value.vin || !form.value.faultType) {
    ElMessage.warning('请填写车辆和故障现象')
    return
  }
  if (!form.value.advisorJudgment.trim()) {
    ElMessage.warning('请填写顾问判断')
    return
  }
  const selectedVehicle = vehicles.value.find((v) => v.vin === form.value.vin)
  if (!selectedVehicle) {
    ElMessage.warning('请选择有效车辆')
    return
  }
  const payload = {
    vin: form.value.vin,
    ownerId: selectedVehicle.ownerId,
    advisorId: userStore.userId,
    faultDescription: buildFaultDescription({
      faultType: form.value.faultType,
      ownerDescription: form.value.ownerDescription,
      advisorJudgment: form.value.advisorJudgment,
    }),
    faultLevel: form.value.faultLevel,
    status: editMode.value ? undefined : 'REGISTERED',
  } as Partial<FaultRecord>
  const request = editMode.value
    ? faultApi.update(editingFaultNo.value, payload)
    : faultApi.create(payload)
  request.then(async () => {
    dialogVisible.value = false
    ElMessage.success(editMode.value ? '故障记录已更新' : '故障登记成功')
    await reloadFaults()
  })
}

async function reloadFaults() {
  const [faults, orders] = await Promise.all([faultApi.list(), workOrderApi.list()])
  tableData.value = Array.isArray(faults) ? faults : []
  workOrders.value = Array.isArray(orders) ? orders : []
}

function workOrderOf(faultId?: number) {
  return faultId ? workOrderMap.value[faultId] : undefined
}

async function createWorkOrder(row: FaultRecord) {
  if (!row.faultId) {
    ElMessage.warning('故障记录无效')
    return
  }
  if (workOrderOf(row.faultId)) {
    router.push(`/work-order/${workOrderOf(row.faultId)?.workOrderId}`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认为故障单 ${row.faultNo} 生成维修工单？`,
      '生成工单',
      { type: 'info', confirmButtonText: '生成', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    const workOrder = await workOrderApi.create({ faultId: row.faultId })
    await reloadFaults()
    ElMessage.success(`已生成工单 ${workOrder.workOrderNo}`)
    try {
      await ElMessageBox.confirm(
        `工单 ${workOrder.workOrderNo} 已创建，是否前往派工？`,
        '生成成功',
        { type: 'success', confirmButtonText: '前往工单', cancelButtonText: '留在此页' },
      )
      router.push(`/work-order/${workOrder.workOrderId}`)
    } catch {
      // 用户选择留在当前页
    }
  } catch {
    // 错误提示由请求拦截器处理
  }
}

function faultTypeLabel(row: FaultRecord) {
  return parseFaultDescription(row.faultDescription).faultType || row.faultType || '—'
}

function ownerDescPreview(row: FaultRecord) {
  const parsed = parseFaultDescription(row.faultDescription)
  return parsed.ownerDescription || (parsed.advisorJudgment ? '—' : row.faultDescription) || '—'
}

function advisorJudgmentPreview(row: FaultRecord) {
  return parseFaultDescription(row.faultDescription).advisorJudgment || '—'
}

async function removeFault(row: FaultRecord) {
  await ElMessageBox.confirm(`确认删除故障单 ${row.faultNo}？`, '删除故障', { type: 'warning' })
  await faultApi.remove(row.faultNo)
  ElMessage.success('故障记录已删除')
  await reloadFaults()
}

onMounted(async () => {
  const [vs, users] = await Promise.all([
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
    userApi.list(),
  ])
  await reloadFaults()
  vehicles.value = vs
  advisors.value = (users || []).filter((u) => u.role === 'ADVISOR' && u.status === 'ENABLED')
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="故障登记" subtitle="售后顾问录入故障现象，关联预约与车辆">
      <template #actions>
        <el-button v-if="can('fault', 'create')" type="primary" @click="openCreate">登记故障</el-button>
      </template>
    </PageHeader>

    <div class="page-card">
      <el-alert
        v-if="hasRouteFilter"
        :title="`看板筛选：${routeFilterLabel}（共 ${filteredData.length} 条）`"
        type="info"
        show-icon
        closable
        style="margin-bottom: 12px"
        @close="clearRouteFilters"
      />
      <el-table :data="filteredData" stripe>
        <el-table-column prop="faultNo" label="故障单号" width="150" />
        <el-table-column label="车辆" width="150">
          <template #default="{ row }">
            <strong>{{ row.licensePlate }}</strong>
            <div class="text-muted">{{ row.model }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="车主" width="90" />
        <el-table-column prop="vin" label="VIN" width="170" show-overflow-tooltip />
        <el-table-column label="故障现象" width="110">
          <template #default="{ row }">{{ faultTypeLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="车主描述" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ ownerDescPreview(row) }}</template>
        </el-table-column>
        <el-table-column label="顾问判断" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ advisorJudgmentPreview(row) }}</template>
        </el-table-column>
        <el-table-column label="登记顾问" width="100">
          <template #default="{ row }">{{ row.advisorName }}</template>
        </el-table-column>
        <el-table-column prop="faultLevel" label="等级" width="90" />
        <el-table-column prop="createdAt" label="登记时间" width="160" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="关联工单" width="150">
          <template #default="{ row }">
            <el-button
              v-if="workOrderOf(row.faultId)"
              link
              type="primary"
              @click="router.push(`/work-order/${workOrderOf(row.faultId)?.workOrderId}`)"
            >
              {{ workOrderOf(row.faultId)?.workOrderNo }}
            </el-button>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="can('fault', 'edit') && row.status !== 'WORK_ORDER_CREATED'"
              link
              type="primary"
              @click="openEdit(row)"
            >编辑</el-button>
            <el-button
              v-if="can('workOrder', 'create') && !['WORK_ORDER_CREATED', 'CLOSED'].includes(row.status)"
              link
              type="success"
              @click="createWorkOrder(row)"
            >
              生成工单
            </el-button>
            <el-button
              v-if="workOrderOf(row.faultId)"
              link
              type="primary"
              @click="router.push(`/work-order/${workOrderOf(row.faultId)?.workOrderId}`)"
            >
              查看工单
            </el-button>
            <el-button v-if="can('fault', 'delete')" link type="danger" @click="removeFault(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editMode ? '编辑故障' : '故障登记'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="车辆 VIN" required>
          <el-select v-model="form.vin" placeholder="选择车辆" style="width: 100%" :disabled="editMode">
            <el-option v-for="v in vehicles" :key="v.vin" :label="`${v.vin} (${v.model})`" :value="v.vin" />
          </el-select>
        </el-form-item>
        <el-form-item label="故障现象" required>
          <el-select v-model="form.faultType" placeholder="顾问归类故障现象" style="width: 100%">
            <el-option v-for="t in faultTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="故障等级">
          <el-select v-model="form.faultLevel" style="width: 100%">
            <el-option label="低" value="LOW" />
            <el-option label="中" value="MEDIUM" />
            <el-option label="高" value="HIGH" />
            <el-option label="紧急" value="CRITICAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="快捷标签">
          <el-space wrap>
            <el-tag v-for="tag in quickTags" :key="tag" style="cursor: pointer" @click="addQuickTag(tag)">{{ tag }}</el-tag>
          </el-space>
        </el-form-item>
        <el-form-item label="车主描述">
          <el-input
            v-model="form.ownerDescription"
            type="textarea"
            :rows="3"
            placeholder="车主口述或预约问题描述"
          />
        </el-form-item>
        <el-form-item label="顾问判断" required>
          <el-input
            v-model="form.advisorJudgment"
            type="textarea"
            :rows="4"
            placeholder="现场核实后的顾问判断（必填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">{{ editMode ? '更新' : '保存' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.text-muted {
  color: #8c8c8c;
  font-size: 12px;
}
</style>
