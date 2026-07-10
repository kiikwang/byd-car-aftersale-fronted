<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Calendar, CircleCheckFilled, Lightning, Odometer, Operation, SetUp, Tools, WarningFilled } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useUserStore } from '@/stores/user'
import { useOwnerVins, buildVehicleListParams } from '@/composables/useScopedVehicles'
import { usePermissions } from '@/composables/usePermissions'
import { batteryApi, vehicleApi, vehicleHealthApi } from '@/api'
import type { BatteryHealthRecord, Vehicle, VehicleHealthItem, VehicleHealthSnapshot } from '@/types'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const ownerVins = useOwnerVins()
const { can } = usePermissions()
const allAlerts = ref<BatteryHealthRecord[]>([])
const ownerInfoMap = ref<Record<string, string>>({})
const vehicles = ref<Vehicle[]>([])
const healthSnapshots = ref<VehicleHealthSnapshot[]>([])
const selectedVin = ref('')
const dialogVisible = ref(false)
const form = ref({
  vin: '',
  soh: 100,
  chargeCycles: 0,
  maxTemperature: 25,
  minTemperature: 20,
  voltageDiff: 0,
  detectTime: '',
})

const scopedAlerts = computed(() =>
  userStore.isOwner
    ? allAlerts.value.filter((b) => ownerVins.value.includes(b.vin))
    : allAlerts.value,
)

const filterLevel = ref('')

/** 每辆车只保留最新一条检测记录（左侧列表） */
const latestAlerts = computed(() => {
  const byVin = new Map<string, BatteryHealthRecord>()
  for (const record of scopedAlerts.value) {
    const prev = byVin.get(record.vin)
    if (!prev || String(record.detectTime || '') > String(prev.detectTime || '')) {
      byVin.set(record.vin, record)
    }
  }
  return Array.from(byVin.values()).sort((a, b) =>
    String(b.detectTime || '').localeCompare(String(a.detectTime || '')),
  )
})

const tableData = computed(() => {
  let list = latestAlerts.value
  if (filterLevel.value) list = list.filter((b) => b.warningLevel === filterLevel.value)
  return list
})

/** 右侧：当前选中车辆的全部历史检测 */
const batteryHistoryForSelected = computed(() =>
  scopedAlerts.value
    .filter((r) => r.vin === selectedVin.value)
    .sort((a, b) => String(b.detectTime || '').localeCompare(String(a.detectTime || ''))),
)

type HealthLevel = 'NORMAL' | 'WARNING' | 'DANGER'
type HealthModule = {
  key: string
  title: string
  level: HealthLevel
  value: string
  desc: string
  action: string
  icon: Component
}
type VehicleHealthSummary = {
  vehicle: Vehicle
  snapshot: VehicleHealthSnapshot
  score: number
  level: HealthLevel
  title: string
  suggestion: string
  modules: HealthModule[]
  riskModules: HealthModule[]
  normalModules: HealthModule[]
}

const ownerHealthSummaries = computed(() =>
  healthSnapshots.value.map((snapshot) => buildVehicleHealthSummary(snapshot)),
)
const selectedHealthSummary = computed(() =>
  ownerHealthSummaries.value.find((summary) => summary.vehicle.vin === selectedVin.value)
    || ownerHealthSummaries.value[0],
)
const selectedBatteryRecord = computed(() =>
  latestAlerts.value.find((record) => record.vin === selectedHealthSummary.value?.vehicle.vin),
)

const moduleIconMap: Record<string, Component> = {
  BATTERY: Lightning,
  TIRE_PRESSURE: Odometer,
  BRAKE: WarningFilled,
  LOW_VOLTAGE_BATTERY: Lightning,
  CHARGING_SYSTEM: SetUp,
  THERMAL_MANAGEMENT: Operation,
  MAINTENANCE: Tools,
  INSPECTION_INSURANCE: Calendar,
}

function remindOwner(row: BatteryHealthRecord) {
  batteryApi.remind(row.vin, userStore.userId).then(() => {
    ElMessage.success(`已向车主 ${ownerInfoMap.value[row.vin] || row.vin} 发送电池健康提醒`)
  })
}

function levelText(level?: HealthLevel) {
  if (level === 'DANGER') return '需尽快处理'
  if (level === 'WARNING') return '建议关注'
  return '状态正常'
}

function buildVehicleHealthSummary(snapshot: VehicleHealthSnapshot): VehicleHealthSummary {
  const vehicle = snapshot.vehicle || vehicles.value.find((v) => v.vin === snapshot.vin) || {
    vin: snapshot.vin,
    ownerId: userStore.ownerId || userStore.userId,
    licensePlate: '',
    catalogId: '',
    model: '未知车型',
    batteryModel: '-',
    purchaseDate: '',
    currentMileage: 0,
    vehicleStatus: 'NORMAL',
  } as Vehicle
  const modules = (snapshot.items || []).map(toHealthModule)
  const level = snapshot.overallLevel || 'NORMAL'
  const riskModules = modules.filter((item) => item.level !== 'NORMAL')
  return {
    vehicle,
    snapshot,
    score: snapshot.healthScore,
    level,
    title: snapshot.summary,
    suggestion: snapshot.suggestion || '建议按车辆健康项目安排后续服务。',
    modules,
    riskModules,
    normalModules: modules.filter((item) => item.level === 'NORMAL'),
  }
}

function toHealthModule(item: VehicleHealthItem): HealthModule {
  return {
    key: `${item.itemType}-${item.itemId || item.itemName}`,
    title: item.itemName,
    level: item.level,
    value: item.metricValue || '-',
    desc: item.description || '暂无说明',
    action: item.actionSuggestion || '按需处理',
    icon: moduleIconMap[item.itemType] || CircleCheckFilled,
  }
}

function vehicleLabel(vin: string) {
  const vehicle = vehicles.value.find((v) => v.vin === vin)
  return vehicle ? `${vehicle.licensePlate || vin} · ${vehicle.model}` : vin
}

function selectVehicle(vin: string) {
  selectedVin.value = vin
}

function selectBatteryRow(row?: BatteryHealthRecord) {
  if (row?.vin) {
    selectVehicle(row.vin)
  }
}

function staffRowClassName({ row }: { row: BatteryHealthRecord }) {
  return row.vin === selectedVin.value ? 'selected-health-row' : ''
}

function goAppointment() {
  router.push('/appointment')
}

function openCreate() {
  form.value = {
    vin: vehicles.value[0]?.vin || '',
    soh: 100,
    chargeCycles: 0,
    maxTemperature: 25,
    minTemperature: 20,
    voltageDiff: 0,
    detectTime: '',
  }
  dialogVisible.value = true
}

function resolveWarningLevel(soh: number): BatteryHealthRecord['warningLevel'] {
  if (soh < 70) return 'DANGER'
  if (soh < 80) return 'WARNING'
  return 'NORMAL'
}

async function submitCreate() {
  if (!form.value.vin || !form.value.detectTime) {
    ElMessage.warning('请选择车辆并填写检测时间')
    return
  }
  await batteryApi.create({
    ...form.value,
    warningLevel: resolveWarningLevel(form.value.soh),
  })
  dialogVisible.value = false
  ElMessage.success('电池检测记录已保存')
  await loadData()
}

async function loadData() {
  const [alerts, vs] = await Promise.all([
    batteryApi.list(),
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
  ])
  allAlerts.value = alerts || []
  vehicles.value = vs || []
  ownerInfoMap.value = Object.fromEntries(
    (vs || []).map((v) => [v.vin, `${v.ownerName || ''}（${v.ownerPhone || ''}）`]),
  )
  const ownerId = userStore.ownerId || userStore.userId
  if (userStore.isOwner) {
    healthSnapshots.value = ownerId ? await vehicleHealthApi.latestByOwner(ownerId) : []
    return
  }
  const latestByVehicle = await Promise.all(
    (vs || []).map(async (vehicle) => {
      const history = await vehicleHealthApi.historyByVin(vehicle.vin)
      return history[0]
    }),
  )
  healthSnapshots.value = latestByVehicle.filter((item): item is VehicleHealthSnapshot => Boolean(item))
  const routeVin = typeof route.query.vin === 'string' ? route.query.vin : ''
  const routeLevel = typeof route.query.level === 'string' ? route.query.level : ''
  if (routeLevel) {
    filterLevel.value = routeLevel
  }
  if (routeVin && healthSnapshots.value.some((snapshot) => snapshot.vin === routeVin)) {
    selectedVin.value = routeVin
  } else if (!selectedVin.value || !healthSnapshots.value.some((snapshot) => snapshot.vin === selectedVin.value)) {
    selectedVin.value = (latestAlerts.value || []).find((item) => item.warningLevel === 'DANGER')?.vin
      || latestAlerts.value[0]?.vin
      || healthSnapshots.value[0]?.vin
      || ''
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <PageHeader
      :title="userStore.isOwner ? '我的车辆健康' : '车辆健康工作台'"
      :subtitle="userStore.isOwner ? '查看车辆健康评分、待处理项目与保养提醒' : '选择左侧车辆查看健康详情，可展开历史检测记录'"
    >
      <template v-if="!userStore.isOwner" #actions>
        <el-button type="primary" @click="openCreate">新增检测记录</el-button>
      </template>
    </PageHeader>

    <div v-if="userStore.isOwner" class="health-center">
      <div
        v-for="summary in ownerHealthSummaries"
        :key="summary.vehicle.vin"
        class="hcard"
        :class="summary.level.toLowerCase()"
      >
        <header class="hcard-hero">
          <div class="hcard-plate">
            <h2>{{ summary.vehicle.licensePlate || summary.vehicle.vin }}</h2>
            <p>{{ summary.vehicle.model }} · {{ summary.vehicle.currentMileage }} km</p>
          </div>
          <div class="hcard-score" :class="summary.level.toLowerCase()">
            <strong>{{ summary.score }}</strong>
            <span>健康分</span>
          </div>
        </header>

        <div class="hcard-status" :class="summary.level.toLowerCase()">
          <span class="dot" />
          <strong>{{ summary.level === 'NORMAL' ? '车辆状态良好' : summary.title }}</strong>
          <em v-if="summary.riskModules.length">{{ summary.riskModules.length }} 项待处理</em>
          <em v-else>按期保养即可</em>
        </div>

        <div v-if="summary.riskModules.length" class="hcard-risks">
          <div
            v-for="module in summary.riskModules"
            :key="module.key"
            class="risk-card"
            :class="module.level.toLowerCase()"
          >
            <div class="risk-card-main">
              <span class="risk-ico"><el-icon><component :is="module.icon" /></el-icon></span>
              <div class="risk-card-text">
                <strong>{{ module.title }}</strong>
                <p>{{ module.desc }}</p>
              </div>
              <span class="risk-val">{{ module.value }}</span>
            </div>
          </div>
        </div>

        <footer class="hcard-foot">
          <el-collapse class="hcard-collapse">
            <el-collapse-item name="detail">
              <template #title>
                <span class="collapse-title">车辆档案与检测明细 · {{ summary.snapshot.detectTime?.slice(0, 10) || '-' }}</span>
              </template>
              <div v-if="summary.normalModules.length" class="normal-module-list">
                <span v-for="module in summary.normalModules" :key="module.key">
                  <el-icon><component :is="CircleCheckFilled" /></el-icon>
                  {{ module.title }}
                </span>
              </div>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="VIN">{{ summary.vehicle.vin }}</el-descriptions-item>
                <el-descriptions-item label="动力电池">{{ summary.vehicle.batteryModel || '-' }}</el-descriptions-item>
                <el-descriptions-item label="下次保养">{{ summary.vehicle.nextMaintenanceDate || '-' }}</el-descriptions-item>
                <el-descriptions-item label="年检到期">{{ summary.vehicle.nextInspectionDate || '-' }}</el-descriptions-item>
                <el-descriptions-item label="保险到期">{{ summary.vehicle.insuranceExpireDate || '-' }}</el-descriptions-item>
                <el-descriptions-item label="车主">{{ summary.vehicle.ownerName || userStore.realName }}</el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>
          </el-collapse>
          <el-button
            :type="summary.level === 'NORMAL' ? 'default' : 'primary'"
            round
            @click="goAppointment"
          >
            预约服务
          </el-button>
        </footer>
      </div>
      <el-empty v-if="ownerHealthSummaries.length === 0" description="暂无车辆健康数据，请确认该车主已绑定车辆并执行富数据/健康迁移脚本" />
    </div>

    <template v-if="!userStore.isOwner">
      <el-row :gutter="16" class="staff-layout">
        <el-col :xs="24" :lg="15">
          <div class="staff-panel">
            <div class="staff-panel-head">
              <h3>电池检测</h3>
              <el-tag v-if="selectedVin" type="danger" effect="plain" size="small">
                {{ vehicleLabel(selectedVin) }}
              </el-tag>
            </div>
            <div class="staff-filters">
              <el-radio-group v-model="filterLevel" size="small">
                <el-radio-button value="">全部</el-radio-button>
                <el-radio-button value="DANGER">异常</el-radio-button>
                <el-radio-button value="WARNING">预警</el-radio-button>
                <el-radio-button value="NORMAL">正常</el-radio-button>
              </el-radio-group>
            </div>

            <el-table
              :data="tableData"
              stripe
              highlight-current-row
              row-key="vin"
              :row-class-name="staffRowClassName"
              @row-click="selectBatteryRow"
              class="staff-table"
            >
              <el-table-column label="车辆" min-width="170">
                <template #default="{ row }">
                  <strong class="cell-plate">{{ vehicleLabel(row.vin).split(' · ')[0] }}</strong>
                  <div class="cell-sub">{{ vehicleLabel(row.vin).split(' · ')[1] || '' }}</div>
                  <div class="vin-label">{{ row.vin }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="soh" label="SOH" width="72" align="center">
                <template #default="{ row }">
                  <span class="soh-val" :class="row.soh < 80 ? 'danger' : row.soh < 90 ? 'warn' : 'ok'">
                    {{ row.soh }}%
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="chargeCycles" label="充电次数" width="88" align="center" />
              <el-table-column prop="maxTemperature" label="最高温" width="76" align="center">
                <template #default="{ row }">{{ row.maxTemperature }}°</template>
              </el-table-column>
              <el-table-column prop="voltageDiff" label="压差" width="72" align="center" />
              <el-table-column label="等级" width="76" align="center">
                <template #default="{ row }">
                  <StatusTag :status="row.warningLevel" />
                </template>
              </el-table-column>
              <el-table-column prop="detectTime" label="检测时间" min-width="150" />
              <el-table-column v-if="can('battery', 'remindOwner')" label="操作" width="88" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button
                    v-if="row.warningLevel !== 'NORMAL'"
                    link
                    type="warning"
                    size="small"
                    @click.stop="remindOwner(row)"
                  >
                    提醒
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-col>

        <el-col :xs="24" :lg="9">
          <div
            class="staff-detail-panel"
            v-if="selectedHealthSummary"
            :class="selectedHealthSummary.level.toLowerCase()"
          >
            <header class="sd-hero">
              <div>
                <h3>{{ selectedHealthSummary.vehicle.licensePlate || selectedHealthSummary.vehicle.vin }}</h3>
                <p>
                  {{ selectedHealthSummary.vehicle.model }}
                  <template v-if="selectedHealthSummary.vehicle.ownerName">
                    · {{ selectedHealthSummary.vehicle.ownerName }}
                  </template>
                </p>
              </div>
              <div class="sd-score" :class="selectedHealthSummary.level.toLowerCase()">
                <strong>{{ selectedHealthSummary.score }}</strong>
                <span>健康分</span>
              </div>
            </header>

            <div class="sd-health-body">
              <div class="sd-status" :class="selectedHealthSummary.level.toLowerCase()">
                <span class="dot" />
                <div class="sd-status-text">
                  <strong>{{ levelText(selectedHealthSummary.level) }}</strong>
                  <p v-if="selectedHealthSummary.suggestion">{{ selectedHealthSummary.suggestion }}</p>
                </div>
                <em v-if="selectedHealthSummary.riskModules.length">{{ selectedHealthSummary.riskModules.length }} 项待处理</em>
                <em v-else>无风险项</em>
              </div>

              <div v-if="selectedHealthSummary.riskModules.length" class="sd-risk-grid">
                <div
                  v-for="module in selectedHealthSummary.riskModules"
                  :key="module.key"
                  class="sd-risk-card"
                  :class="module.level.toLowerCase()"
                >
                  <div class="sd-risk-card-top">
                    <span class="sd-risk-ico"><el-icon><component :is="module.icon" /></el-icon></span>
                    <div class="sd-risk-card-info">
                      <strong>{{ module.title }}</strong>
                      <p>{{ module.desc }}</p>
                    </div>
                  </div>
                  <div class="sd-risk-card-bottom">
                    <span class="sd-risk-metric">{{ module.value }}</span>
                    <span class="sd-risk-hint">{{ module.action }}</span>
                  </div>
                </div>
              </div>

              <div v-else class="sd-all-clear">
                <el-icon :size="28" color="#52c41a"><CircleCheckFilled /></el-icon>
                <span>各项检测正常，建议按期保养</span>
              </div>
            </div>

            <el-collapse class="sd-collapse">
              <el-collapse-item name="detail">
                <template #title>
                  <span class="collapse-title">正常项目与电池明细</span>
                </template>
                <div v-if="selectedHealthSummary.normalModules.length" class="normal-module-list">
                  <span v-for="module in selectedHealthSummary.normalModules" :key="module.key">
                    <el-icon><component :is="CircleCheckFilled" /></el-icon>
                    {{ module.title }}
                  </span>
                </div>
                <el-descriptions v-if="selectedBatteryRecord" :column="2" border size="small" class="sd-battery-desc">
                  <el-descriptions-item label="SOH">{{ selectedBatteryRecord.soh }}%</el-descriptions-item>
                  <el-descriptions-item label="充电次数">{{ selectedBatteryRecord.chargeCycles }} 次</el-descriptions-item>
                  <el-descriptions-item label="最高温度">{{ selectedBatteryRecord.maxTemperature }}°C</el-descriptions-item>
                  <el-descriptions-item label="压差">{{ selectedBatteryRecord.voltageDiff }}V</el-descriptions-item>
                  <el-descriptions-item label="检测时间" :span="2">
                    {{ selectedBatteryRecord.detectTime?.replace('T', ' ').slice(0, 19) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="VIN" :span="2">{{ selectedHealthSummary.vehicle.vin }}</el-descriptions-item>
                </el-descriptions>
                <div v-else class="sd-vin">VIN：{{ selectedHealthSummary.vehicle.vin }}</div>
              </el-collapse-item>
              <el-collapse-item v-if="batteryHistoryForSelected.length > 0" name="history">
                <template #title>
                  <span class="collapse-title">历史检测记录（{{ batteryHistoryForSelected.length }} 次）</span>
                </template>
                <el-table :data="batteryHistoryForSelected" size="small" stripe class="history-table">
                  <el-table-column prop="detectTime" label="检测时间" min-width="140" />
                  <el-table-column label="SOH" width="72" align="center">
                    <template #default="{ row }">
                      <span :class="row.soh < 80 ? 'danger-text' : ''">{{ row.soh }}%</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="chargeCycles" label="充电次数" width="88" align="center" />
                  <el-table-column label="等级" width="76" align="center">
                    <template #default="{ row }">
                      <StatusTag :status="row.warningLevel" />
                    </template>
                  </el-table-column>
                </el-table>
              </el-collapse-item>
            </el-collapse>

            <div class="sd-actions" v-if="can('battery', 'remindOwner') && selectedBatteryRecord?.warningLevel !== 'NORMAL'">
              <el-button type="warning" round @click="remindOwner(selectedBatteryRecord!)">
                提醒车主
              </el-button>
            </div>
          </div>

          <div class="staff-detail-panel staff-empty" v-else>
            <el-empty description="点击左侧记录查看车辆健康" :image-size="80" />
          </div>
        </el-col>
      </el-row>
    </template>

    <el-dialog v-model="dialogVisible" title="新增电池检测记录" width="520px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="车辆 VIN" required>
          <el-select v-model="form.vin" placeholder="选择车辆" style="width: 100%">
            <el-option v-for="v in vehicles" :key="v.vin" :label="`${v.licensePlate || v.vin} ${v.model}`" :value="v.vin" />
          </el-select>
        </el-form-item>
        <el-form-item label="SOH(%)">
          <el-input-number v-model="form.soh" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="充电次数">
          <el-input-number v-model="form.chargeCycles" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最高温度">
          <el-input-number v-model="form.maxTemperature" :min="-40" :max="120" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最低温度">
          <el-input-number v-model="form.minTemperature" :min="-40" :max="120" style="width: 100%" />
        </el-form-item>
        <el-form-item label="压差(V)">
          <el-input-number v-model="form.voltageDiff" :min="0" :step="0.001" :precision="3" style="width: 100%" />
        </el-form-item>
        <el-form-item label="检测时间" required>
          <el-date-picker
            v-model="form.detectTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
h3 {
  font-size: 15px;
  font-weight: 600;
}

.vin-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.health-center {
  display: grid;
  gap: 16px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

/* ---------- 车主健康卡片（App 风格聚合） ---------- */
.hcard {
  background: #fff;
  border-radius: 20px;
  border: 1px solid #eef0f3;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-top: 4px solid #52c41a;
}

.hcard.warning {
  border-top-color: #faad14;
}

.hcard.danger {
  border-top-color: #e60012;
}

.hcard-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.hcard-plate h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #1f2329;
}

.hcard-plate p {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8c93a0;
}

.hcard-score {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f0faf0;
  border: 3px solid #52c41a;
}

.hcard-score.warning {
  background: #fff8e6;
  border-color: #faad14;
}

.hcard-score.danger {
  background: #fff1f0;
  border-color: #e60012;
}

.hcard-score strong {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: #1f2329;
}

.hcard-score span {
  font-size: 11px;
  color: #8c93a0;
  margin-top: 2px;
}

.hcard-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f6ffed;
}

.hcard-status.warning {
  background: #fffbe6;
}

.hcard-status.danger {
  background: #fff1f0;
}

.hcard-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
  flex-shrink: 0;
}

.hcard-status.warning .dot {
  background: #faad14;
}

.hcard-status.danger .dot {
  background: #e60012;
}

.hcard-status strong {
  flex: 1;
  font-size: 15px;
  color: #1f2329;
}

.hcard-status em {
  font-style: normal;
  font-size: 13px;
  font-weight: 600;
  color: #8c93a0;
}

.hcard-status.warning em {
  color: #d48806;
}

.hcard-status.danger em {
  color: #e60012;
}

.hcard-risks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.risk-card {
  border-radius: 14px;
  border: 1px solid #ffe58f;
  background: linear-gradient(135deg, #fffbe6 0%, #fff 100%);
  padding: 14px 16px;
}

.risk-card.danger {
  border-color: #ffccc7;
  background: linear-gradient(135deg, #fff1f0 0%, #fff 100%);
}

.risk-card-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.risk-card-text {
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: 14px;
    color: #1f2329;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #8c93a0;
  }
}

.risk-ico {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #d48806;
  background: rgba(250, 173, 20, 0.14);
  flex-shrink: 0;
}

.risk-card.danger .risk-ico {
  color: #e60012;
  background: rgba(230, 0, 18, 0.12);
}

.risk-val {
  font-size: 15px;
  font-weight: 700;
  color: #d48806;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: center;
}

.risk-card.danger .risk-val {
  color: #e60012;
}

.hcard-foot {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hcard-collapse {
  flex: 1;
  border: none;
}

.hcard-collapse :deep(.el-collapse-item__header),
.hcard-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.hcard-collapse :deep(.el-collapse-item__header) {
  height: 36px;
  line-height: 36px;
}

.collapse-title {
  font-size: 13px;
  color: #8c93a0;
}

.normal-module-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f6ffed;
    color: #389e0d;
    font-size: 12px;
  }
}

/* ---------- 员工工作台 ---------- */
.staff-layout {
  align-items: flex-start;
}

.staff-panel {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  padding: 18px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
}

.staff-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.staff-filters {
  margin-bottom: 12px;
}

.cell-plate {
  font-size: 14px;
  color: #1f2329;
}

.cell-sub {
  font-size: 12px;
  color: #8c93a0;
  margin-top: 2px;
}

.soh-val {
  font-weight: 700;
  font-size: 13px;
}

.soh-val.ok { color: #52c41a; }
.soh-val.warn { color: #faad14; }
.soh-val.danger { color: #e60012; }

:deep(.selected-health-row td) {
  background: #fff7f6 !important;
}

:deep(.selected-health-row td:first-child) {
  box-shadow: inset 3px 0 0 #e60012;
}

.staff-detail-panel {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  padding: 18px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 16px;
  border-top: 4px solid #52c41a;
}

.staff-detail-panel.warning {
  border-top-color: #faad14;
}

.staff-detail-panel.danger {
  border-top-color: #e60012;
}

.staff-detail-panel.staff-empty {
  border-top-color: #eef0f3;
  min-height: 280px;
  justify-content: center;
}

.sd-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1f2329;
  }

  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #8c93a0;
  }
}

.sd-score {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f0faf0;
  border: 3px solid #52c41a;
}

.sd-score.warning {
  background: #fff8e6;
  border-color: #faad14;
}

.sd-score.danger {
  background: #fff1f0;
  border-color: #e60012;
}

.sd-score strong {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: #1f2329;
}

.sd-score span {
  font-size: 10px;
  color: #8c93a0;
  margin-top: 2px;
}

.sd-health-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sd-status {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f6ffed;
}

.sd-status.warning { background: #fffbe6; }
.sd-status.danger { background: #fff1f0; }

.sd-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
  flex-shrink: 0;
  margin-top: 6px;
}

.sd-status.warning .dot { background: #faad14; }
.sd-status.danger .dot { background: #e60012; }

.sd-status-text {
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: 15px;
    color: #1f2329;
    line-height: 1.4;
  }

  p {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #8c93a0;
  }
}

.sd-status em {
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
  color: #8c93a0;
  white-space: nowrap;
  flex-shrink: 0;
  padding-top: 2px;
}

.sd-status.danger em { color: #e60012; }
.sd-status.warning em { color: #d48806; }

.sd-risk-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sd-risk-card {
  border-radius: 14px;
  border: 1px solid #ffe58f;
  background: #fff;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.sd-risk-card.danger {
  border-color: #ffccc7;
  background: linear-gradient(180deg, #fffafa 0%, #fff 100%);
}

.sd-risk-card.warning {
  border-color: #ffe58f;
  background: linear-gradient(180deg, #fffdf5 0%, #fff 100%);
}

.sd-risk-card-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.sd-risk-card-info {
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #1f2329;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #8c93a0;
  }
}

.sd-risk-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #f0f0f0;
}

.sd-risk-metric {
  font-size: 18px;
  font-weight: 700;
  color: #d48806;
}

.sd-risk-card.danger .sd-risk-metric {
  color: #e60012;
}

.sd-risk-hint {
  font-size: 12px;
  color: #8c93a0;
  text-align: right;
  line-height: 1.4;
}

.sd-all-clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  border-radius: 14px;
  background: #f6ffed;
  color: #389e0d;
  font-size: 13px;
}

.sd-risk-ico {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #d48806;
  background: rgba(250, 173, 20, 0.14);
  flex-shrink: 0;
}

.sd-risk-card.danger .sd-risk-ico {
  color: #e60012;
  background: rgba(230, 0, 18, 0.12);
}

.sd-collapse {
  border: none;
}

.sd-collapse :deep(.el-collapse-item__header),
.sd-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.sd-collapse :deep(.el-collapse-item__header) {
  height: 32px;
  line-height: 32px;
}

.sd-battery-desc {
  margin-top: 4px;
}

.sd-vin {
  font-size: 11px;
  color: #b0b5bf;
  word-break: break-all;
}

.sd-actions {
  display: flex;
  justify-content: flex-end;
}

.history-table {
  margin-top: 8px;
}

.danger-text {
  color: #e60012;
  font-weight: 600;
}

@media (max-width: 640px) {
  .hcard-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .hcard-foot .el-button {
    width: 100%;
  }

  .staff-detail-panel {
    position: static;
    margin-top: 12px;
  }
}
</style>
