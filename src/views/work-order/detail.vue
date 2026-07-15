<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useUserStore } from '@/stores/user'
import { useOwnerVins } from '@/composables/useScopedVehicles'
import { usePermissions } from '@/composables/usePermissions'
import { agentApi, faultApi, partUsageApi, partsApi, settlementApi, userApi, workOrderApi } from '@/api'
import type { WarrantyEstimate } from '@/api'
import { getWorkOrderProgress } from '@/utils/work-order-progress'
import { parseFaultDescription } from '@/utils/fault-form'
import { formatDateTime } from '@/utils/format-datetime'
import type { FaultRecord, Part, PartUsageRecord, Settlement, SysUser, WorkOrder } from '@/types'



const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const ownerVins = useOwnerVins()
const { can, isTechnician, isAdvisor, isServiceManager } = usePermissions()
const id = route.params.id as string

const order = ref<WorkOrder>()
const faults = ref<FaultRecord[]>([])
const technicians = ref<SysUser[]>([])
const assignDialogVisible = ref(false)
const selectedTechnicianId = ref<number | null>(null)
const assignMode = ref<'assign' | 'reassign'>('assign')
const completeDialogVisible = ref(false)
const completeForm = ref({ repairResult: '', warrantyAmount: 0 })
const warrantyEstimate = ref<WarrantyEstimate | null>(null)
const proposeDialogVisible = ref(false)
const proposeForm = ref({ partId: null as number | null, quantity: 1 })
const agentSuggestion = ref('暂无诊断建议')
const linkedFault = ref<FaultRecord | null>(null)
const partUsages = ref<PartUsageRecord[]>([])
const parts = ref<Part[]>([])
const settlement = ref<Settlement>()
const laborCostEditing = ref(false)
const laborCostInput = ref(0)

const partMap = computed(() =>
  Object.fromEntries(parts.value.filter((p) => p.partId).map((p) => [p.partId as number, p])),
)
const parsedFault = computed(() =>
  parseFaultDescription(linkedFault.value?.faultDescription || order.value?.faultType || ''),
)
const progress = computed(() => {
  if (!order.value) return 0
  return getWorkOrderProgress(order.value.status)
})
const timeline = computed(() => {
  if (!order.value) return []
  const o = order.value
  const nodes: Array<{ time: string; content: string; type: 'primary' | 'success' | 'warning'; order: number }> = []
  const push = (time: string | undefined, content: string, type: 'primary' | 'success' | 'warning', orderIndex: number) => {
    nodes.push({ time: formatDateTime(time), content, type, order: orderIndex })
  }
  push(o.createdAt, '工单创建', 'primary', 1)
  if (o.assignedAt || (o.technicianId && ['ASSIGNED', 'IN_PROGRESS', 'PART_WAITING', 'COMPLETED'].includes(o.status))) {
    push(o.assignedAt || o.createdAt, '已派工', 'success', 2)
  }
  if (o.startedAt) {
    push(o.startedAt, '开始维修', 'warning', 3)
  }
  if (o.partWaitingAt) {
    push(o.partWaitingAt, '等待备件', 'warning', 4)
  }
  const usageStatusText: Record<string, string> = {
    PROPOSED: '待审批',
    APPLIED: '待审批',
    APPROVED: '已审批',
    USED: '已审批',
    REJECTED: '已驳回',
    RETURNED: '已退回',
  }
  ;[...partUsages.value]
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .forEach((u) => {
      const part = partMap.value[u.partId]
      push(
        u.createdAt,
        `申请备件：${part?.partName || '备件'} x${u.quantity}（${usageStatusText[u.status] || u.status}）`,
        u.status === 'REJECTED' ? 'warning' : 'primary',
        3.5,
      )
    })
  if (o.partsArrivedAt) {
    push(o.partsArrivedAt, '备件已到', 'success', 5)
  }
  if (o.status === 'COMPLETED') {
    push(o.finishedAt || o.updatedAt, '维修完成', 'success', 6)
  }
  return nodes.sort((a, b) => a.order - b.order).map(({ time, content, type }) => ({ time, content, type }))
})



async function loadDetail() {
  let found: WorkOrder | undefined
  try {
    if (/^\d+$/.test(id)) {
      found = await workOrderApi.getById(id)
    } else {
      const orders = await workOrderApi.list()
      found = (orders || []).find((o) => o.workOrderNo === id)
    }
  } catch {
    const orders = await workOrderApi.list()
    found = (orders || []).find((o) => String(o.workOrderId) === id || o.workOrderNo === id)
  }
  const [fs, users] = await Promise.all([faultApi.list(), userApi.list()])
  faults.value = fs || []
  technicians.value = (users || [])
    .filter((u) => u.role === 'TECHNICIAN' && u.status === 'ENABLED')
    .sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')))
  if (!found) {
    ElMessage.warning('工单不存在')
    router.replace('/work-order')
    return
  }
  const f = (fs || []).find((x: any) => x.faultId === found.faultId)
  linkedFault.value = f || null
  const vin = f?.vin || found.vin || ''
  if (userStore.isOwner && !ownerVins.value.includes(vin)) {
    ElMessage.warning('无权查看该工单')
    router.replace('/work-order')
    return
  }
  order.value = {
    ...found,
    vin,
    faultType: f?.faultDescription || '-',
    technician: technicians.value.find((t) => t.userId === found.technicianId)?.realName || found.technician || '待派工',
  }
  if (found.workOrderId) {
    const [usages, ps, st] = await Promise.all([
      partUsageApi.listByWorkOrder(found.workOrderId),
      partsApi.list(),
      settlementApi.getByWorkOrder(found.workOrderId).catch(() => undefined),
    ])
    partUsages.value = usages || []
    parts.value = ps || []
    settlement.value = st
  }
  if (f?.faultId) {
    try {
      const history = await agentApi.listByFault(f.faultId)
      agentSuggestion.value = history?.[0]?.diagnosisSuggestion || agentSuggestion.value
    } catch {
      // keep default text
    }
  }
}

onMounted(loadDetail)



function assignToMe() {
  if (!order.value?.workOrderId) return
  workOrderApi.assign(order.value.workOrderId, userStore.userId).then(() => {
    ElMessage.success('已接单')
    loadDetail()
  })
}



function startRepair() {
  if (!order.value?.workOrderId) return
  workOrderApi.start(order.value.workOrderId).then(() => {
    ElMessage.success('状态已更新：正在维修')
    loadDetail()
  })
}



function needParts() {
  if (!order.value?.workOrderId) return
  workOrderApi.partWaiting(order.value.workOrderId).then(() => {
    ElMessage.info('已标记待备件，请前往备件模块提交申请')
    loadDetail()
  })
}



function resumeRepair() {
  if (!order.value?.workOrderId) return
  workOrderApi.partsArrived(order.value.workOrderId).then(() => {
    ElMessage.success('备件已到位，继续维修')
    loadDetail()
  })
}

function openLaborCostEdit() {
  laborCostInput.value = Number(order.value?.laborCost || 0)
  laborCostEditing.value = true
}

function saveLaborCost() {
  if (!order.value?.workOrderId) return
  workOrderApi.updateLaborCost(order.value.workOrderId, laborCostInput.value).then(() => {
    laborCostEditing.value = false
    ElMessage.success('人工费已更新')
    loadDetail()
  })
}



function openCompleteDialog() {
  completeForm.value = { repairResult: order.value?.repairResult || '', warrantyAmount: 0 }
  warrantyEstimate.value = null
  completeDialogVisible.value = true
  if (order.value?.workOrderId) {
    workOrderApi.warrantyEstimate(order.value.workOrderId).then((est) => {
      warrantyEstimate.value = est
      completeForm.value.warrantyAmount = est?.suggestedWarrantyAmount ?? 0
    }).catch(() => {
      // 无已审批备件时仍可手填
    })
  }
}

function openProposeDialog() {
  proposeForm.value = { partId: parts.value[0]?.partId ?? null, quantity: 1 }
  proposeDialogVisible.value = true
}

function submitPropose() {
  if (!order.value?.workOrderId || !proposeForm.value.partId) {
    ElMessage.warning('请选择备件')
    return
  }
  partUsageApi.apply({
    workOrderId: order.value.workOrderId,
    partId: proposeForm.value.partId,
    quantity: proposeForm.value.quantity,
    technicianId: userStore.userId,
  }).then(() => {
    proposeDialogVisible.value = false
    ElMessage.success('备件申请已提交，等待备件员审批')
    loadDetail()
  })
}

function completeRepair() {
  if (!order.value?.workOrderId) return
  if (!completeForm.value.repairResult.trim()) {
    ElMessage.warning('请填写维修结果')
    return
  }
  workOrderApi.complete(order.value.workOrderId, {
    repairResult: completeForm.value.repairResult.trim(),
    operatorId: userStore.userId,
    warrantyAmount: completeForm.value.warrantyAmount || 0,
  }).then(async () => {
    completeDialogVisible.value = false
    ElMessage.success('维修完成，已生成结算单')
    await loadDetail()
  })
}



function openAssignDialog(mode: 'assign' | 'reassign') {
  assignMode.value = mode
  selectedTechnicianId.value = technicians.value[0]?.userId ?? null
  assignDialogVisible.value = true
}

function confirmAssign() {
  if (!order.value?.workOrderId || !selectedTechnicianId.value) {
    ElMessage.warning('请选择技师')
    return
  }
  workOrderApi.assign(order.value.workOrderId, selectedTechnicianId.value).then(() => {
    ElMessage.success(assignMode.value === 'reassign' ? '已改派技师' : '已派工')
    assignDialogVisible.value = false
    loadDetail()
  })
}

function advisorAssign() {
  openAssignDialog('assign')
}

function managerReassign() {
  openAssignDialog('reassign')
}

function managerSupervise() {
  if (!order.value?.workOrderId) return
  workOrderApi.supervise(order.value.workOrderId, userStore.userId).then(() => {
    ElMessage.success('已发送督办通知给责任技师与顾问')
  })
}

</script>



<template>

  <div class="page-container">

    <PageHeader :title="`工单详情 - ${id}`">

      <template #actions>

        <el-button @click="router.back()">返回</el-button>

        <el-button v-if="isAdvisor && can('workOrder', 'assign') && order?.status === 'CREATED'" type="primary" @click="advisorAssign">

          派工给技师

        </el-button>

        <el-button v-if="isServiceManager && can('workOrder', 'supervise')" type="warning" @click="managerSupervise">
          督办催办
        </el-button>
        <el-button v-if="isServiceManager && can('workOrder', 'reassign')" @click="managerReassign">
          改派技师
        </el-button>
        <el-button v-if="isTechnician && order?.status === 'CREATED'" type="primary" @click="assignToMe">接单</el-button>

        <el-button v-if="isTechnician && order?.status === 'ASSIGNED'" type="primary" @click="startRepair">开始维修</el-button>

        <el-button v-if="isTechnician && order?.status === 'IN_PROGRESS'" @click="needParts">标记待备件</el-button>

        <el-button v-if="isTechnician && ['IN_PROGRESS', 'PART_WAITING'].includes(order?.status || '')" @click="openProposeDialog">申请备件</el-button>

        <el-button v-if="isTechnician && order?.status === 'PART_WAITING'" type="warning" @click="resumeRepair">备件到位</el-button>

        <el-button v-if="isTechnician && ['IN_PROGRESS', 'PART_WAITING'].includes(order?.status || '')" type="success" @click="openCompleteDialog">

          维修完成

        </el-button>

      </template>

    </PageHeader>



    <div v-if="order" class="page-card" style="margin-bottom: 16px">

      <el-descriptions :column="3" border>

        <el-descriptions-item label="工单号">{{ order.workOrderNo }}</el-descriptions-item>

        <el-descriptions-item label="VIN">{{ order.vin }}</el-descriptions-item>

        <el-descriptions-item label="故障现象">{{ order.faultType }}</el-descriptions-item>

        <el-descriptions-item label="技师">{{ order.technician || '待派工' }}</el-descriptions-item>

        <el-descriptions-item label="状态"><StatusTag :status="order.status" /></el-descriptions-item>

        <el-descriptions-item v-if="!userStore.isOwner" label="人工费">
          <template v-if="laborCostEditing && (isAdvisor || isServiceManager)">
            <el-input-number v-model="laborCostInput" :min="0" :step="50" size="small" />
            <el-button link type="primary" @click="saveLaborCost">保存</el-button>
            <el-button link @click="laborCostEditing = false">取消</el-button>
          </template>
          <template v-else>
            ¥{{ order.laborCost || 0 }}
            <el-button
              v-if="(isAdvisor || isServiceManager) && order.status !== 'COMPLETED'"
              link
              type="primary"
              @click="openLaborCostEdit"
            >
              修改
            </el-button>
          </template>
        </el-descriptions-item>

        <el-descriptions-item label="进度" :span="3">

          <el-progress :percentage="progress" style="width: 240px" color="#e60012" />

        </el-descriptions-item>

      </el-descriptions>

    </div>

    <div v-if="settlement" class="page-card" style="margin-bottom: 16px">
      <h3>关联结算单</h3>
      <el-descriptions :column="3" border style="margin-top: 12px">
        <el-descriptions-item label="结算单号">{{ settlement.settlementNo }}</el-descriptions-item>
        <el-descriptions-item label="人工费">¥{{ settlement.laborAmount }}</el-descriptions-item>
        <el-descriptions-item label="备件费">¥{{ settlement.partAmount }}</el-descriptions-item>
        <el-descriptions-item label="质保减免">¥{{ settlement.warrantyAmount }}</el-descriptions-item>
        <el-descriptions-item label="应付总额">
          <strong style="color: #e60012">¥{{ settlement.totalAmount }}</strong>
        </el-descriptions-item>
        <el-descriptions-item label="支付状态">
          <StatusTag :status="settlement.paymentStatus" />
        </el-descriptions-item>
        <el-descriptions-item v-if="settlement.managerStatus" label="经理审核">
          <StatusTag :status="settlement.managerStatus" />
        </el-descriptions-item>
      </el-descriptions>
      <el-button
        v-if="userStore.isOwner && settlement.managerStatus === 'APPROVED' && settlement.paymentStatus === 'UNPAID'"
        type="primary"
        style="margin-top: 12px"
        @click="router.push('/settlement')"
      >
        去支付
      </el-button>
    </div>

    <el-row v-if="order" :gutter="16">

      <el-col :span="isTechnician || isAdvisor ? 14 : 24">

        <div class="page-card">

          <h3>维修进度时间线</h3>

          <el-timeline style="margin-top: 16px">

            <el-timeline-item v-for="(item, i) in timeline" :key="i" :timestamp="item.time" :type="item.type as 'primary' | 'success' | 'warning'">

              {{ item.content }}

            </el-timeline-item>

          </el-timeline>

        </div>

      </el-col>



      <el-col v-if="isTechnician || isAdvisor" :span="10">

        <div v-if="isTechnician" class="page-card" style="margin-bottom: 16px">
          <h3>故障背景（车主 / 顾问）</h3>
          <div class="fault-desc-block owner">
            <strong>车主描述</strong>
            <p>{{ parsedFault.ownerDescription || '—' }}</p>
          </div>
          <div class="fault-desc-block advisor">
            <strong>顾问判断</strong>
            <p v-if="parsedFault.advisorJudgment">{{ parsedFault.advisorJudgment }}</p>
            <p v-else class="text-muted">—</p>
            <p v-if="linkedFault?.advisorName" class="fault-meta">登记顾问：{{ linkedFault.advisorName }}</p>
          </div>
          <el-button
            v-if="linkedFault?.faultId && can('agent', 'create')"
            type="primary"
            plain
            style="margin-top: 12px"
            @click="router.push({ path: '/agent', query: { faultId: String(linkedFault.faultId), workOrderId: String(order?.workOrderId), auto: '1' } })"
          >
            发起 Agent 诊断
          </el-button>
        </div>

        <div v-if="isTechnician" class="page-card" style="margin-bottom: 16px">
          <h3>Agent 诊断建议</h3>
          <el-alert type="info" :closable="false" show-icon style="margin-top: 12px">
            <p>{{ agentSuggestion }}</p>
          </el-alert>
          <p class="hint">可参考以上建议执行检测与维修</p>
        </div>

        <div class="page-card">
          <h3>备件领用明细</h3>
          <el-table :data="partUsages" stripe size="small" style="margin-top: 12px" empty-text="暂无备件领用">
            <el-table-column label="备件" min-width="160">
              <template #default="{ row }">
                {{ partMap[row.partId]?.partName || `备件#${row.partId}` }}
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column prop="unitPrice" label="单价" width="100" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <StatusTag :status="row.status" />
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="申请时间" width="160" />
          </el-table>
        </div>

      </el-col>

    </el-row>

    <el-dialog v-model="assignDialogVisible" :title="assignMode === 'reassign' ? '改派技师' : '派工给技师'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="技师">
          <el-select v-model="selectedTechnicianId" placeholder="选择技师" style="width: 100%">
            <el-option
              v-for="tech in technicians"
              :key="tech.userId"
              :label="tech.realName"
              :value="tech.userId"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAssign">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="completeDialogVisible" title="维修完成" width="520px">
      <el-form :model="completeForm" label-width="100px">
        <el-form-item label="维修结果" required>
          <el-input v-model="completeForm.repairResult" type="textarea" :rows="4" placeholder="请填写实际维修结果" />
        </el-form-item>
        <el-alert
          v-if="warrantyEstimate"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <p>费用合计 ¥{{ warrantyEstimate.grossAmount }}（人工费 ¥{{ warrantyEstimate.laborAmount }} + 备件费 ¥{{ warrantyEstimate.partAmount }}）</p>
          <p>系统建议质保减免 ¥{{ warrantyEstimate.suggestedWarrantyAmount }}，客户应付约 ¥{{ warrantyEstimate.customerPayable }}</p>
          <p v-for="(note, i) in warrantyEstimate.notes || []" :key="i" class="hint">{{ note }}</p>
        </el-alert>
        <el-form-item label="质保减免">
          <el-input-number
            v-model="completeForm.warrantyAmount"
            :min="0"
            :max="warrantyEstimate?.suggestedWarrantyAmount ?? warrantyEstimate?.grossAmount ?? 999999"
            :step="100"
            style="width: 100%"
          />
          <p class="hint">质保内费用由厂家承担；不可超过系统建议上限</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="completeRepair">确认完工</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="proposeDialogVisible" title="申请备件" width="440px">
      <el-form label-width="80px">
        <el-form-item label="备件">
          <el-select v-model="proposeForm.partId" placeholder="选择备件" style="width: 100%">
            <el-option
              v-for="p in parts"
              :key="p.partId"
              :label="`${p.partName} (库存${p.stockQuantity})`"
              :value="p.partId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="proposeForm.quantity" :min="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="proposeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPropose">提交申请</el-button>
      </template>
    </el-dialog>
  </div>

</template>



<style scoped>

h3 { font-size: 15px; font-weight: 600; }

.info-text { margin-top: 8px; color: #595959; font-size: 14px; line-height: 1.6; }

.hint { margin-top: 12px; font-size: 12px; color: #8c8c8c; }
.text-muted { color: #8c8c8c; font-size: 13px; }

.fault-desc-block {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;

  strong {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
  }

  p {
    margin: 0;
    color: #595959;
    white-space: pre-wrap;
  }

  &.owner {
    background: #f6ffed;
    border: 1px solid #d9f7be;
    strong { color: #389e0d; }
  }

  &.advisor {
    background: #fff7e6;
    border: 1px solid #ffe7ba;
    strong { color: #d48806; }
  }
}

.fault-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #8c8c8c;
}

</style>


