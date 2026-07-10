<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useUserStore } from '@/stores/user'
import { buildVehicleListParams } from '@/composables/useScopedVehicles'
import { batteryApi, faultApi, vehicleApi, workOrderApi } from '@/api'
import type { BatteryHealthRecord, FaultRecord, Vehicle, WorkOrder } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const vin = route.params.vin as string
const vehicle = ref<Vehicle>()
const allFaults = ref<FaultRecord[]>([])
const allBattery = ref<BatteryHealthRecord[]>([])
const allWorkOrders = ref<WorkOrder[]>([])

const faults = computed(() => allFaults.value.filter((f) => f.vin === vin))
const battery = computed(() => allBattery.value.find((b) => b.vin === vin))
const faultMap = computed(() =>
  Object.fromEntries(faults.value.filter((f) => f.faultId).map((f) => [f.faultId as number, f])),
)
const workOrders = computed(() =>
  allWorkOrders.value
    .map((w) => {
      const fault = faultMap.value[w.faultId || 0]
      return {
        ...w,
        vin: fault?.vin || w.vin,
        faultType: fault?.faultDescription || w.faultType || '未登记故障描述',
        repairResult: w.repairResult || (w.status === 'COMPLETED' ? '已完工，维修结果未填写' : '维修尚未完成'),
      }
    })
    .filter((w) => w.vin === vin),
)

onMounted(async () => {
  try {
    const [v, fs, bs, ws] = await Promise.all([
      vehicleApi.getByVin(vin, buildVehicleListParams(userStore.role, userStore.userId)),
      faultApi.listByVin(vin),
      batteryApi.list(),
      workOrderApi.list(),
    ])
    vehicle.value = v
    allFaults.value = fs || []
    allBattery.value = bs || []
    allWorkOrders.value = ws || []
  } catch {
    ElMessage.warning('无权查看该车辆或车辆不存在')
    router.replace('/vehicle')
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader :title="`车辆详情 - ${vin}`">
      <template #actions>
        <el-button @click="router.back()">返回</el-button>
      </template>
    </PageHeader>

    <div v-if="vehicle" class="page-card" style="margin-bottom: 16px">
      <el-descriptions :column="3" border>
        <el-descriptions-item label="VIN">{{ vehicle.vin }}</el-descriptions-item>
        <el-descriptions-item label="车牌">{{ vehicle.licensePlate }}</el-descriptions-item>
        <el-descriptions-item label="车型">{{ vehicle.model }}</el-descriptions-item>
        <el-descriptions-item label="电池型号">{{ vehicle.batteryModel }}</el-descriptions-item>
        <el-descriptions-item label="购车时间">{{ vehicle.purchaseDate }}</el-descriptions-item>
        <el-descriptions-item label="里程">{{ vehicle.currentMileage }} km</el-descriptions-item>
        <el-descriptions-item label="车主">{{ vehicle.ownerName }} / {{ vehicle.ownerPhone }}</el-descriptions-item>
        <el-descriptions-item label="负责顾问">{{ vehicle.advisorName || '—' }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <el-tabs v-if="vehicle" type="border-card">
      <el-tab-pane label="历史维修记录">
        <el-table :data="workOrders" stripe empty-text="暂无维修记录">
          <el-table-column prop="workOrderNo" label="工单号" width="160" />
          <el-table-column prop="faultType" label="故障现象" />
          <el-table-column prop="repairResult" label="维修结果" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="创建时间" width="160" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <StatusTag :status="row.status" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="`故障历史 (${faults.length})`">
        <el-table :data="faults" stripe empty-text="暂无故障登记">
          <el-table-column prop="faultNo" label="故障单号" width="160" />
          <el-table-column prop="faultDescription" label="故障现象" show-overflow-tooltip />
          <el-table-column label="等级" width="90">
            <template #default="{ row }">
              <el-tag
                :type="row.faultLevel === 'CRITICAL' ? 'danger' : row.faultLevel === 'HIGH' ? 'warning' : row.faultLevel === 'MEDIUM' ? 'info' : 'success'"
                size="small"
              >
                {{ ({ LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '紧急' } as Record<string, string>)[row.faultLevel] || row.faultLevel }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <StatusTag :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="登记时间" width="160" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="电池检测数据">
        <el-descriptions v-if="battery" :column="2" border>
          <el-descriptions-item label="SOH 健康度">{{ battery.soh }}%</el-descriptions-item>
          <el-descriptions-item label="充电次数">{{ battery.chargeCycles }}</el-descriptions-item>
          <el-descriptions-item label="最高温度">{{ battery.maxTemperature }}°C</el-descriptions-item>
          <el-descriptions-item label="压差">{{ battery.voltageDiff }} mV</el-descriptions-item>
          <el-descriptions-item label="预警等级">{{ battery.warningLevel }}</el-descriptions-item>
          <el-descriptions-item label="检测时间">{{ battery.detectTime }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="暂无电池检测数据" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
