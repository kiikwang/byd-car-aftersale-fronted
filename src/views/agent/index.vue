<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { useUserStore } from '@/stores/user'
import { usePermissions } from '@/composables/usePermissions'
import type { DiagnosisResult, Vehicle, BatteryHealthRecord, FaultRecord, WorkOrder } from '@/types'
import { agentApi, batteryApi, faultApi, vehicleApi, workOrderApi } from '@/api'
import { buildVehicleListParams } from '@/composables/useScopedVehicles'
import { buildAgentInputFromFault, parseFaultDescription } from '@/utils/fault-form'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { can } = usePermissions()
const loading = ref(false)
const result = ref<DiagnosisResult | null>(null)

const vehicles = ref<Vehicle[]>([])
const batteries = ref<BatteryHealthRecord[]>([])
const faults = ref<FaultRecord[]>([])
const myOrders = ref<WorkOrder[]>([])
const allOrders = ref<WorkOrder[]>([])

const selectedFaultId = ref<number | null>(null)

const selectedFault = computed(() =>
  faults.value.find((f) => f.faultId === selectedFaultId.value),
)

const parsedFault = computed(() =>
  parseFaultDescription(selectedFault.value?.faultDescription || ''),
)

const vehicle = computed(() =>
  vehicles.value.find((v) => v.vin === selectedFault.value?.vin),
)

const battery = computed(() => {
  const vin = selectedFault.value?.vin
  if (!vin) return undefined
  return batteries.value
    .filter((b) => b.vin === vin)
    .sort((a, b) => String(b.detectTime || '').localeCompare(String(a.detectTime || '')))[0]
})

type DiagnoseOption = {
  key: string
  faultId: number
  workOrderId?: number
  label: string
  group: 'mine' | 'order' | 'fault'
}

const diagnoseOptions = computed<DiagnoseOption[]>(() => {
  const options: DiagnoseOption[] = []
  const usedFaultIds = new Set<number>()

  const pushOrder = (o: WorkOrder, group: 'mine' | 'order') => {
    if (!o.faultId || usedFaultIds.has(o.faultId)) return
    const fault = faults.value.find((f) => f.faultId === o.faultId)
    if (!fault) return
    usedFaultIds.add(o.faultId)
    const plate = vehicles.value.find((v) => v.vin === fault.vin)?.licensePlate || fault.vin
    options.push({
      key: `wo-${o.workOrderId}`,
      faultId: o.faultId,
      workOrderId: o.workOrderId,
      group,
      label: `${o.workOrderNo} · ${plate} · ${o.status}`,
    })
  }

  myOrders.value
    .filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status))
    .forEach((o) => pushOrder(o, 'mine'))
  myOrders.value
    .filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status))
    .forEach((o) => pushOrder(o, 'mine'))

  allOrders.value.forEach((o) => {
    if (myOrders.value.some((m) => m.workOrderId === o.workOrderId)) return
    if (['COMPLETED', 'CANCELLED'].includes(o.status)) return
    pushOrder(o, 'order')
  })

  faults.value
    .filter((f) => f.faultId && ['REGISTERED', 'DIAGNOSED'].includes(f.status))
    .forEach((f) => {
      if (usedFaultIds.has(f.faultId!)) return
      usedFaultIds.add(f.faultId!)
      const plate = vehicles.value.find((v) => v.vin === f.vin)?.licensePlate || f.vin
      options.push({
        key: `fault-${f.faultId}`,
        faultId: f.faultId!,
        group: 'fault',
        label: `${f.faultNo} · ${plate} · ${f.status}（待关联工单也可诊断）`,
      })
    })

  return options
})

const mineOptions = computed(() => diagnoseOptions.value.filter((o) => o.group === 'mine'))
const otherOrderOptions = computed(() => diagnoseOptions.value.filter((o) => o.group === 'order'))
const faultOnlyOptions = computed(() => diagnoseOptions.value.filter((o) => o.group === 'fault'))

function applyRouteSelection() {
  const faultId = Number(route.query.faultId)
  if (faultId && faults.value.some((f) => f.faultId === faultId)) {
    selectedFaultId.value = faultId
    return
  }
  const workOrderId = Number(route.query.workOrderId)
  if (workOrderId) {
    const order = [...myOrders.value, ...allOrders.value].find((o) => o.workOrderId === workOrderId)
    if (order?.faultId) selectedFaultId.value = order.faultId
  }
}

watch(selectedFaultId, () => {
  result.value = null
})

async function startDiagnosis() {
  if (!selectedFault.value?.faultId) {
    ElMessage.warning('请先选择工单或故障记录')
    return
  }
  const faultDesc = buildAgentInputFromFault(selectedFault.value.faultDescription)
  loading.value = true
  result.value = null
  try {
    const diag: any = await agentApi.diagnose({
      faultId: selectedFault.value.faultId,
      vin: selectedFault.value.vin,
      faultDesc,
    })
    result.value = {
      suggestion: diag?.diagnosisSuggestion || '暂无建议',
      risks: [`风险等级：${diag?.riskLevel || 'LOW'}`],
      recommendedTests: String(diag?.recommendedChecks || '全车故障码扫描').split(';').filter(Boolean),
      riskLevel: diag?.riskLevel || 'LOW',
      faultId: diag?.faultId,
      diagnosisId: diag?.diagnosisId,
    }
    ElMessage.success('Agent 诊断完成')
  } catch (e: any) {
    ElMessage.error(e?.message || '诊断失败')
  } finally {
    loading.value = false
  }
}

function goWorkOrders() {
  router.push('/work-order')
}

function goFaults() {
  router.push('/fault')
}

onMounted(async () => {
  const [vs, bs, fs, mine, all] = await Promise.all([
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
    batteryApi.list(),
    faultApi.list(),
    workOrderApi.listMine(userStore.userId).catch(() => [] as WorkOrder[]),
    workOrderApi.list().catch(() => [] as WorkOrder[]),
  ])
  vehicles.value = vs || []
  batteries.value = bs || []
  faults.value = fs || []
  myOrders.value = mine || []
  allOrders.value = all || []
  applyRouteSelection()
  if (!selectedFaultId.value && diagnoseOptions.value.length) {
    selectedFaultId.value = diagnoseOptions.value[0].faultId
  }
  if (selectedFaultId.value && route.query.auto === '1') {
    await startDiagnosis()
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="智能诊断" subtitle="结合车主描述与顾问判断，辅助技师排查故障">
      <template #actions>
        <el-button @click="goWorkOrders">去工单列表</el-button>
        <el-button @click="goFaults">去故障登记</el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="!diagnoseOptions.length"
      type="warning"
      :closable="false"
      show-icon
      title="暂无可诊断数据"
      style="margin-bottom: 16px"
    >
      <p>
        当前账号下没有关联故障的工单，也没有待诊断故障。请先用顾问账号登记故障并生成/派工，
        或执行数据库种子脚本 <code>seed-production.sql</code> 导入演示工单后，用 <code>tech001</code> 登录再试。
      </p>
    </el-alert>

    <el-row :gutter="16">
      <el-col :span="10">
        <div class="page-card input-panel">
          <h3>诊断输入</h3>
          <el-form label-position="top">
            <el-form-item label="关联工单 / 故障">
              <el-select
                v-model="selectedFaultId"
                placeholder="选择工单或故障记录"
                style="width: 100%"
                filterable
              >
                <el-option-group v-if="mineOptions.length" label="我的工单">
                  <el-option
                    v-for="item in mineOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.faultId"
                  />
                </el-option-group>
                <el-option-group v-if="otherOrderOptions.length" label="其他在修工单">
                  <el-option
                    v-for="item in otherOrderOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.faultId"
                  />
                </el-option-group>
                <el-option-group v-if="faultOnlyOptions.length" label="待诊断故障（可无工单）">
                  <el-option
                    v-for="item in faultOnlyOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.faultId"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>

            <template v-if="selectedFault">
              <div class="desc-block owner">
                <h4>车主描述</h4>
                <p>{{ parsedFault.ownerDescription || '（无单独记录，见下方原文）' }}</p>
              </div>
              <div class="desc-block advisor">
                <h4>顾问判断</h4>
                <p>{{ parsedFault.advisorJudgment || '（顾问未单独填写判断）' }}</p>
              </div>
              <div v-if="parsedFault.faultType" class="desc-meta">
                故障现象归类：<strong>{{ parsedFault.faultType }}</strong>
              </div>
            </template>

            <el-button
              v-if="can('agent', 'create')"
              type="primary"
              :loading="loading"
              :disabled="!selectedFaultId"
              style="width: 100%; margin-top: 12px"
              @click="startDiagnosis"
            >
              <el-icon><Cpu /></el-icon>
              开始智能诊断
            </el-button>
          </el-form>

          <el-divider />

          <div v-if="vehicle" class="context-info">
            <h4>车辆信息</h4>
            <p>车型：{{ vehicle.model }} | 里程：{{ vehicle.currentMileage }} km</p>
            <p>电池：{{ vehicle.batteryModel }}</p>
            <template v-if="battery">
              <h4 style="margin-top: 12px">最新电池检测</h4>
              <p>SOH {{ battery.soh }}% | 充电 {{ battery.chargeCycles }} 次</p>
              <p>最高温 {{ battery.maxTemperature }}°C | 压差 {{ battery.voltageDiff }} V</p>
            </template>
          </div>
        </div>
      </el-col>

      <el-col :span="14">
        <div class="page-card result-panel">
          <h3>
            <el-icon color="#e60012"><MagicStick /></el-icon>
            诊断结果
          </h3>

          <div v-if="loading" class="loading-area">
            <el-skeleton :rows="6" animated />
            <p class="streaming">Agent 正在结合车主描述、顾问判断与电池数据进行分析...</p>
          </div>

          <template v-else-if="result">
            <el-alert type="info" :closable="false" show-icon title="初步诊断建议" style="margin-bottom: 16px">
              <p>{{ result.suggestion }}</p>
            </el-alert>

            <div class="section">
              <h4><el-icon color="#ff4d4f"><Warning /></el-icon> 风险提示 ({{ result.riskLevel }})</h4>
              <ul>
                <li v-for="(r, i) in result.risks" :key="i">{{ r }}</li>
              </ul>
            </div>

            <div class="section">
              <h4><el-icon color="#00a651"><List /></el-icon> 推荐检测项目</h4>
              <el-tag v-for="(t, i) in result.recommendedTests" :key="i" style="margin: 4px" type="success" effect="plain">
                {{ t }}
              </el-tag>
            </div>
          </template>

          <el-empty v-else description="选择工单或故障后查看车主/顾问描述，再开始诊断" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.input-panel h3,
.result-panel h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.desc-block {
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.6;

  h4 {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: #595959;
    white-space: pre-wrap;
  }

  &.owner {
    background: #f6ffed;
    border: 1px solid #d9f7be;
    h4 { color: #389e0d; }
  }

  &.advisor {
    background: #fff7e6;
    border: 1px solid #ffe7ba;
    h4 { color: #d48806; }
  }
}

.desc-meta {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.context-info {
  font-size: 13px;
  color: #595959;

  h4 {
    font-size: 13px;
    color: #1f1f1f;
    margin-bottom: 4px;
  }

  p {
    margin-bottom: 4px;
  }
}

.section {
  margin-bottom: 16px;

  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    margin-bottom: 8px;
  }

  ul {
    padding-left: 20px;
    color: #595959;
    font-size: 14px;
    line-height: 1.8;
  }
}

.streaming {
  margin-top: 12px;
  color: #e60012;
  font-size: 14px;
  line-height: 1.6;
}
</style>
