<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import FaultRegisterDialog from '@/components/FaultRegisterDialog.vue'
import { useUserStore } from '@/stores/user'
import { useScopedVehicles, buildVehicleListParams } from '@/composables/useScopedVehicles'
import { usePermissions } from '@/composables/usePermissions'
import { appointmentApi, faultApi, serviceCenterApi, vehicleApi } from '@/api'
import { APPOINTMENT_TIME_HINT } from '@/constants/business-hours'
import { getServiceTypeConfig, SERVICE_TYPE_OPTIONS } from '@/constants/service-types'
import {
  roundToQuarterHour,
  validateAppointmentTime,
} from '@/utils/appointment-time'
import { dedupeByKey } from '@/utils/dedupe'
import {
  APPOINTMENT_SCOPE_STATUSES,
  appointmentFilterLabel,
  isToday as isTodayDate,
  parseStatusList,
  queryString,
} from '@/utils/route-filter'
import type { Appointment, FaultRecord, Vehicle } from '@/types'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const { can } = usePermissions()
const myVehicles = useScopedVehicles()
const tableData = ref<Appointment[]>([])
const faultRecords = ref<FaultRecord[]>([])
const ownerVehicles = ref<Vehicle[]>([])
const dialogVisible = ref(false)
const faultDialogVisible = ref(false)
const faultAppointment = ref<Appointment | null>(null)
const serviceCenters = ref<Array<{ centerId: number; centerName: string; phone?: string }>>([])
const filterServiceType = ref('')
const targetAppointmentNo = computed(() => typeof route.query.appointmentNo === 'string' ? route.query.appointmentNo : '')
const filterScope = computed(() => queryString(route.query.scope))
const filterStatuses = computed(() => {
  if (filterScope.value && APPOINTMENT_SCOPE_STATUSES[filterScope.value]) {
    return APPOINTMENT_SCOPE_STATUSES[filterScope.value]
  }
  return parseStatusList(queryString(route.query.status))
})
const filterTodayOnly = computed(() => route.query.today === '1')
const hasRouteFilter = computed(() =>
  filterStatuses.value.length > 0 || filterTodayOnly.value || Boolean(filterScope.value),
)
const routeFilterLabel = computed(() =>
  appointmentFilterLabel(filterScope.value, filterStatuses.value, filterTodayOnly.value),
)

function clearRouteFilters() {
  router.replace({ path: '/appointment' })
}
const form = ref({
  vin: '',
  centerId: null as number | null,
  appointmentDate: '',
  appointmentSlot: '',
  serviceType: 'FAULT_REPAIR' as Appointment['serviceType'],
  problemDescription: '',
})

const serviceTypeOptions = SERVICE_TYPE_OPTIONS
const currentOwnerId = computed(() => userStore.ownerId || userStore.userId)
const availableVehicles = computed(() => ownerVehicles.value.length ? ownerVehicles.value : myVehicles.value)

const filteredData = computed(() =>
  tableData.value.filter((a) => {
    if (targetAppointmentNo.value && a.appointmentNo !== targetAppointmentNo.value) return false
    if (filterServiceType.value && a.serviceType !== filterServiceType.value) return false
    if (filterStatuses.value.length && !filterStatuses.value.includes(a.status)) return false
    if (filterTodayOnly.value && !isTodayDate(a.appointmentTime)) return false
    return true
  }),
)

const faultByAppointmentId = computed(() =>
  Object.fromEntries(
    faultRecords.value
      .filter((f) => f.appointmentId)
      .map((f) => [f.appointmentId as number, f]),
  ),
)

function hasFaultForAppointment(row: Appointment) {
  if (!row.appointmentId) return false
  return Boolean(faultByAppointmentId.value[row.appointmentId])
}

function openFaultRegister(row: Appointment) {
  faultAppointment.value = row
  faultDialogVisible.value = true
}

function serviceTypeConfig(serviceType?: Appointment['serviceType']) {
  return getServiceTypeConfig(serviceType)
}

const ownerAppointmentCards = computed(() =>
  filteredData.value.map((appointment) => ({
    ...appointment,
    vehicle: myVehicles.value.find((v) => v.vin === appointment.vin),
    service: serviceTypeConfig(appointment.serviceType),
  })),
)

const selectedService = computed(() => serviceTypeConfig(form.value.serviceType))
const slotOptions = computed(() => {
  const slots: string[] = []
  for (let hour = 8; hour < 18; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return slots
})

function openCreate() {
  form.value = { vin: '', centerId: null, appointmentDate: '', appointmentSlot: '', serviceType: 'FAULT_REPAIR', problemDescription: '' }
  dialogVisible.value = true
}

function toBackendDateTime(value: string) {
  return value ? value.replace(' ', 'T') : value
}

async function submitForm() {
  if (!form.value.vin || !form.value.centerId || !form.value.appointmentDate || !form.value.appointmentSlot) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const vehicle = availableVehicles.value.find((v) => v.vin === form.value.vin)
  if (!vehicle) {
    ElMessage.warning('请选择您名下的车辆')
    return
  }
  try {
    const appointmentTime = roundToQuarterHour(`${form.value.appointmentDate} ${form.value.appointmentSlot}:00`)
    const timeError = validateAppointmentTime(appointmentTime)
    if (timeError) {
      ElMessage.warning(timeError)
      return
    }
    await appointmentApi.create({
      vin: form.value.vin,
      ownerId: vehicle.ownerId,
      centerId: form.value.centerId!,
      appointmentTime: toBackendDateTime(appointmentTime),
      serviceType: form.value.serviceType,
      problemDescription: form.value.problemDescription || selectedService.value.desc,
    })
    dialogVisible.value = false
    filterServiceType.value = ''
    if (targetAppointmentNo.value) {
      router.replace('/appointment')
    }
    ElMessage.success('预约提交成功，等待顾问确认')
    await loadData()
  } catch {
    ElMessage.error('预约提交失败，请检查后端是否已启动、时间格式和必填项是否正确')
  }
}

const OWNER_CANCELLABLE_STATUSES: Appointment['status'][] = ['PENDING', 'CONFIRMED']

function canOwnerCancel(status: Appointment['status']) {
  return OWNER_CANCELLABLE_STATUSES.includes(status)
}

function canCancelAppointment(row: Appointment) {
  if (userStore.isOwner) return canOwnerCancel(row.status)
  return can('appointment', 'cancel')
}

function vehicleLabel(vehicle?: Vehicle) {
  if (!vehicle) return '车辆信息'
  return `${vehicle.licensePlate || vehicle.vin} · ${vehicle.model}`
}

function confirmAppointment(row: Appointment) {
  appointmentApi.updateStatus(row.appointmentNo, 'CONFIRMED').then(async () => {
    ElMessage.success('预约已确认')
    await loadData()
  })
}

async function markArrived(row: Appointment) {
  await appointmentApi.updateStatus(row.appointmentNo, 'ARRIVED')
  ElMessage.success('已标记车主到店')
  await loadData()
  const updated = tableData.value.find((a) => a.appointmentNo === row.appointmentNo) || { ...row, status: 'ARRIVED' as const }
  if (can('fault', 'create') && !hasFaultForAppointment(updated)) {
    openFaultRegister(updated)
  }
}

function cancelAppointment(row: Appointment) {
  ElMessageBox.confirm('确定要取消该预约吗？取消后需重新预约。', '取消预约', {
    type: 'warning',
    confirmButtonText: '确认取消',
    cancelButtonText: '暂不取消',
  }).then(() =>
    appointmentApi.updateStatus(row.appointmentNo, 'CANCELLED').then(async () => {
      ElMessage.success('预约已取消')
      await loadData()
    }),
  ).catch(() => {})
}

async function loadData() {
  const [list, centers, vehicles, faults] = await Promise.all([
    appointmentApi.list(),
    serviceCenterApi.list(),
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
    can('fault', 'view') ? faultApi.list() : Promise.resolve([]),
  ])
  faultRecords.value = faults || []
  serviceCenters.value = dedupeByKey(centers || [], (c) => c.phone || c.centerId).map((c) => ({
    centerId: c.centerId,
    centerName: c.centerName,
    phone: c.phone,
  }))
  ownerVehicles.value = userStore.isOwner
    ? (vehicles || []).filter((v) => v.ownerId === currentOwnerId.value)
    : []
  const ownerVins = new Set(ownerVehicles.value.map((v) => v.vin))
  tableData.value = userStore.isOwner
    ? list.filter((a) => ownerVins.has(a.vin) || a.ownerId === currentOwnerId.value)
    : list
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <PageHeader
      :title="userStore.isOwner ? '我的预约' : '车主预约'"
      :subtitle="userStore.isOwner ? '发起维保预约并跟踪进度' : '确认预约、标记到店并登记故障'"
    >
      <template #actions>
        <el-button v-if="can('appointment', 'create')" type="primary" @click="openCreate">新建预约</el-button>
      </template>
    </PageHeader>

    <div class="page-card">
      <el-alert
        v-if="targetAppointmentNo"
        :title="`已定位预约单：${targetAppointmentNo}`"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-alert
        v-else-if="hasRouteFilter"
        :title="`看板筛选：${routeFilterLabel}（共 ${filteredData.length} 条）`"
        type="info"
        show-icon
        closable
        style="margin-bottom: 12px"
        @close="clearRouteFilters"
      />
      <div class="search-bar">
        <el-radio-group v-model="filterServiceType">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button v-for="item in serviceTypeOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="userStore.isOwner" class="owner-appointments">
        <div
          v-for="item in ownerAppointmentCards"
          :key="item.appointmentNo"
          class="appointment-card"
          :class="{ emergency: item.serviceType === 'EMERGENCY_RESCUE' }"
        >
          <div class="appointment-main">
            <div>
              <el-tag :type="item.service.type" effect="light" round>{{ item.service.label }}</el-tag>
              <h3>{{ item.appointmentTime }}</h3>
              <p>{{ vehicleLabel(item.vehicle) }}</p>
            </div>
            <StatusTag :status="item.status" />
          </div>
          <div class="appointment-meta">
            <span>门店：{{ item.centerName || '待确认门店' }}</span>
            <span>预约单：{{ item.appointmentNo }}</span>
          </div>
          <p class="appointment-desc">{{ item.problemDescription }}</p>
          <div class="appointment-actions">
            <el-alert
              v-if="item.serviceType === 'EMERGENCY_RESCUE' && item.status === 'PENDING'"
              title="紧急救援已标记高优先级，门店会优先联系处理"
              type="error"
              :closable="false"
              show-icon
            />
            <el-button
              v-if="canOwnerCancel(item.status)"
              type="danger"
              plain
              @click="cancelAppointment(item)"
            >
              取消预约
            </el-button>
          </div>
        </div>
        <el-empty v-if="ownerAppointmentCards.length === 0" description="暂无预约记录" />
      </div>

      <el-table v-else :data="filteredData" stripe>
        <el-table-column prop="appointmentNo" label="预约单号" width="150" />
        <el-table-column v-if="!userStore.isOwner" prop="ownerName" label="车主" width="100" />
        <el-table-column prop="vin" label="VIN" width="180" />
        <el-table-column prop="centerName" label="服务门店" />
        <el-table-column label="服务类型" width="110">
          <template #default="{ row }">
            <el-tag :type="serviceTypeConfig(row.serviceType).type" effect="light" round>
              {{ serviceTypeConfig(row.serviceType).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appointmentTime" label="预约时间" width="160" />
        <el-table-column prop="problemDescription" label="问题描述" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="can('appointment', 'confirm') && row.status === 'PENDING'" link type="primary" @click="confirmAppointment(row)">
              确认
            </el-button>
            <el-button v-if="can('appointment', 'confirm') && row.status === 'CONFIRMED'" link type="success" @click="markArrived(row)">
              已到店
            </el-button>
            <el-button
              v-if="can('fault', 'create') && row.status === 'ARRIVED' && !hasFaultForAppointment(row)"
              link
              type="warning"
              @click="openFaultRegister(row)"
            >
              登记故障
            </el-button>
            <el-button
              v-if="can('fault', 'view') && hasFaultForAppointment(row)"
              link
              type="primary"
              @click="router.push('/fault?status=REGISTERED')"
            >
              查看故障
            </el-button>
            <el-button
              v-if="canCancelAppointment(row)"
              link
              type="danger"
              @click="cancelAppointment(row)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="新建预约" width="520px">
      <el-form :model="form" label-width="90px">
        <el-alert :title="selectedService.desc" type="info" :closable="false" show-icon style="margin-bottom: 16px" />
        <el-form-item label="服务类型">
          <el-select v-model="form.serviceType" placeholder="选择服务类型" style="width: 100%">
            <el-option v-for="item in serviceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="车辆">
          <el-select v-model="form.vin" placeholder="选择车辆" style="width: 100%">
            <el-option v-for="v in availableVehicles" :key="v.vin" :label="`${v.licensePlate} ${v.model}`" :value="v.vin" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务门店">
          <el-select v-model="form.centerId" placeholder="选择门店" style="width: 100%">
            <el-option v-for="s in serviceCenters" :key="s.centerId" :label="s.centerName" :value="s.centerId" />
          </el-select>
        </el-form-item>
        <el-form-item label="预约时间">
          <div class="time-picker-group">
            <el-date-picker
              v-model="form.appointmentDate"
              type="date"
              placeholder="选择日期"
              style="flex: 1"
              value-format="YYYY-MM-DD"
            />
            <el-select v-model="form.appointmentSlot" placeholder="选择时段" style="width: 180px">
              <el-option v-for="slot in slotOptions" :key="slot" :label="slot" :value="slot" />
            </el-select>
          </div>
          <el-alert
            :title="APPOINTMENT_TIME_HINT"
            type="success"
            :closable="false"
            style="margin-top: 8px"
          />
        </el-form-item>
        <el-form-item :label="form.serviceType === 'FAULT_REPAIR' ? '故障现象' : form.serviceType === 'EMERGENCY_RESCUE' ? '救援情况' : '服务备注'">
          <el-input v-model="form.problemDescription" type="textarea" :rows="3" :placeholder="selectedService.placeholder" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">提交</el-button>
      </template>
    </el-dialog>

    <FaultRegisterDialog
      v-model="faultDialogVisible"
      :appointment="faultAppointment"
      @success="loadData"
    />
  </div>
</template>

<style scoped>
.owner-appointments {
  display: grid;
  gap: 14px;
}

.appointment-card {
  border: 1px solid #ebeef5;
  border-radius: 14px;
  padding: 16px;
  background: #fff;
}

.appointment-card.emergency {
  border-color: #ffccc7;
  background: #fff7f6;
}

.appointment-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.appointment-main h3 {
  margin: 10px 0 4px;
  font-size: 18px;
  color: #1f1f1f;
}

.appointment-main p,
.appointment-desc {
  margin: 0;
  color: #606266;
}

.appointment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 12px 0 8px;
  font-size: 13px;
  color: #8c8c8c;
}

.appointment-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8c;
}

.time-picker-group {
  width: 100%;
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>

