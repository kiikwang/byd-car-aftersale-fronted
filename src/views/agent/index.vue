<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { useUserStore } from '@/stores/user'
import { usePermissions } from '@/composables/usePermissions'
import type { DiagnosisResult, Vehicle, BatteryHealthRecord, FaultRecord, WorkOrder } from '@/types'
import { agentApi, batteryApi, faultApi, vehicleApi, workOrderApi } from '@/api'
import { buildVehicleListParams } from '@/composables/useScopedVehicles'

const route = useRoute()
const userStore = useUserStore()
const { can } = usePermissions()
const loading = ref(false)
const result = ref<DiagnosisResult | null>(null)

const vehicles = ref<Vehicle[]>([])
const batteries = ref<BatteryHealthRecord[]>([])
const faults = ref<FaultRecord[]>([])
const myOrders = ref<WorkOrder[]>([])

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

const battery = computed(() =>
  batteries.value.find((b) => b.vin === selectedFault.value?.vin),
)

const orderOptions = computed(() =>
  myOrders.value
    .filter((o) => o.faultId)
    .map((o) => {
      const fault = faults.value.find((f) => f.faultId === o.faultId)
      const plate = vehicles.value.find((v) => v.vin === fault?.vin)?.licensePlate || fault?.vin || o.vin
      return {
        faultId: o.faultId as number,
        workOrderId: o.workOrderId,
        label: `${o.workOrderNo} · ${plate} · ${fault?.status || '-'}`,
      }
    }),
)

function applyRouteSelection() {
  const faultId = Number(route.query.faultId)
  if (faultId && faults.value.some((f) => f.faultId === faultId)) {
    selectedFaultId.value = faultId
  }
}

watch(selectedFaultId, () => {
  result.value = null
})

async function startDiagnosis() {
  if (!selectedFault.value?.faultId) {
    ElMessage.warning('请选择关联工单的故障记录')
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

onMounted(async () => {
  const [vs, bs, fs, orders] = await Promise.all([
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
    batteryApi.list(),
    faultApi.list(),
    workOrderApi.listMine(userStore.userId),
  ])
  vehicles.value = vs || []
  batteries.value = bs || []
  faults.value = fs || []
  myOrders.value = orders || []
  applyRouteSelection()
  if (!selectedFaultId.value && orderOptions.value.length) {
    selectedFaultId.value = orderOptions.value[0].faultId
  }
  if (selectedFaultId.value && route.query.auto === '1') {
    await startDiagnosis()
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="智能诊断" subtitle="结合车主描述与顾问判断，辅助技师排查故障" />

    <el-row :gutter="16">
      <el-col :span="10">
        <div class="page-card input-panel">
          <h3>诊断输入</h3>
          <el-form label-position="top">
            <el-form-item label="关联工单 / 故障">
              <el-select
                v-model="selectedFaultId"
                placeholder="选择我的维修工单"
                style="width: 100%"
                filterable
              >
                <el-option
                  v-for="item in orderOptions"
                  :key="item.faultId"
                  :label="item.label"
                  :value="item.faultId"
                />
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

          <el-empty v-else description="选择工单后查看车主/顾问描述，再开始诊断" />
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
