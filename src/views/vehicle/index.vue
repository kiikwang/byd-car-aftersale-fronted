<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import VehicleCoverImage from '@/components/VehicleCoverImage.vue'
import { useUserStore } from '@/stores/user'
import { usePermissions } from '@/composables/usePermissions'
import { useScopedVehicles, reloadVehicles } from '@/composables/useScopedVehicles'
import { BATTERY_MODEL_OPTIONS, VEHICLE_MODEL_OPTIONS, findModelOption } from '@/constants/vehicle-options'
import { formatLicensePlate } from '@/utils/format-datetime'
import { userApi, vehicleApi } from '@/api'
import type { SysUser, Vehicle } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const { can } = usePermissions()
const isAdvisor = computed(() => userStore.role === 'ADVISOR')
const isAdmin = computed(() => userStore.role === 'ADMIN')
const vehicleScopeParams = computed(() =>
  isAdvisor.value && userStore.userId ? { advisorId: userStore.userId } : undefined,
)
const scopedVehicles = useScopedVehicles()

const keyword = ref('')
const tableData = ref([...scopedVehicles.value])
const dialogVisible = ref(false)
const editMode = ref(false)
const editingVin = ref('')
const advisors = ref<SysUser[]>([])
const form = ref({
  vin: '',
  ownerId: undefined as number | undefined,
  ownerName: '',
  ownerPhone: '',
  advisorId: undefined as number | undefined,
  licensePlate: '',
  platePrefix: '',
  plateNumber: '',
  catalogId: '',
  model: '',
  batteryModel: BATTERY_MODEL_OPTIONS[0],
  purchaseDate: '',
  currentMileage: 0,
  nextMaintenanceDate: '',
  nextInspectionDate: '',
  insuranceExpireDate: '',
})

/** 车牌拆分输入：前段（省份简称+字母）+ 后段（数字/字母），保存时自动拼接中间的 "·" */
const PLATE_PREFIX_PATTERN = /^[\u4e00-\u9fa5][A-Z]$/
watch([() => form.value.platePrefix, () => form.value.plateNumber], ([prefix, number]) => {
  const p = (prefix || '').trim()
  const n = (number || '').trim().toUpperCase()
  form.value.licensePlate = p && n ? `${p}·${n}` : p || n
})

function splitLicensePlate(plate?: string) {
  const formatted = formatLicensePlate(plate || '')
  const [prefix, number] = formatted.split('·')
  return { prefix: prefix || '', number: number || '' }
}

const modelOptions = computed(() => {
  const seen = new Set<string>()
  const list = VEHICLE_MODEL_OPTIONS.filter((item) => {
    if (seen.has(item.value)) return false
    seen.add(item.value)
    return true
  })
  // 编辑已有档案时，若车型不在预设列表，临时并入以便下拉能回显
  if (form.value.model && !seen.has(form.value.model)) {
    list.push({
      value: form.value.model,
      label: form.value.model,
      catalogId: form.value.catalogId || '',
      defaultBattery: form.value.batteryModel,
      network: '王朝网',
      powertrain: 'BEV',
    })
  }
  return list
})

const batteryOptions = computed(() => {
  const set = new Set(BATTERY_MODEL_OPTIONS)
  if (form.value.batteryModel) set.add(form.value.batteryModel)
  return Array.from(set)
})

const pageSubtitle = computed(() =>
  userStore.isOwner
    ? `我的车辆 · 共 ${scopedVehicles.value.length} 辆`
    : isAdvisor.value
      ? `我的客户车辆 · 共 ${scopedVehicles.value.length} 辆`
      : '门店车辆档案管理',
)

watch(scopedVehicles, (list) => {
  tableData.value = filterList(list)
}, { immediate: true })

function filterList(source: Vehicle[] = scopedVehicles.value) {
  const kw = keyword.value.trim().toLowerCase()
  return source.filter(
    (v) =>
      !kw ||
      v.vin.toLowerCase().includes(kw) ||
      v.model.toLowerCase().includes(kw) ||
      (v.ownerName && v.ownerName.includes(kw)) ||
      v.licensePlate.toLowerCase().includes(kw) ||
      (v.network && v.network.includes(kw)),
  )
}

function handleSearch() {
  tableData.value = filterList()
}

function viewDetail(vin: string) {
  router.push(`/vehicle/${vin}`)
}

function onModelChange(model: string) {
  const option = findModelOption(model)
  form.value.catalogId = option?.catalogId || ''
  if (option?.defaultBattery) {
    form.value.batteryModel = option.defaultBattery
  }
}

function openCreate() {
  editMode.value = false
  editingVin.value = ''
  form.value = {
    vin: '',
    ownerId: undefined,
    ownerName: '',
    ownerPhone: '',
    advisorId: isAdvisor.value ? userStore.userId : advisors.value[0]?.userId,
    licensePlate: '',
    platePrefix: '',
    plateNumber: '',
    catalogId: modelOptions.value[0]?.catalogId || '',
    model: modelOptions.value[0]?.value || '',
    batteryModel: modelOptions.value[0]?.defaultBattery || BATTERY_MODEL_OPTIONS[0],
    purchaseDate: '',
    currentMileage: 0,
    nextMaintenanceDate: '',
    nextInspectionDate: '',
    insuranceExpireDate: '',
  }
  dialogVisible.value = true
}

function openEdit(vehicle: Vehicle) {
  editMode.value = true
  editingVin.value = vehicle.vin
  const { prefix, number } = splitLicensePlate(vehicle.licensePlate)
  form.value = {
    vin: vehicle.vin,
    ownerId: vehicle.ownerId,
    ownerName: vehicle.ownerName || '',
    ownerPhone: vehicle.ownerPhone || '',
    advisorId: vehicle.advisorId,
    licensePlate: vehicle.licensePlate,
    platePrefix: prefix,
    plateNumber: number,
    catalogId: vehicle.catalogId || '',
    model: vehicle.model,
    batteryModel: vehicle.batteryModel,
    purchaseDate: vehicle.purchaseDate,
    currentMileage: vehicle.currentMileage,
    nextMaintenanceDate: vehicle.nextMaintenanceDate || '',
    nextInspectionDate: vehicle.nextInspectionDate || '',
    insuranceExpireDate: vehicle.insuranceExpireDate || '',
  }
  dialogVisible.value = true
}

async function submitCreate() {
  const advisorId = isAdvisor.value ? userStore.userId : form.value.advisorId
  if (!form.value.vin || !form.value.model || !form.value.batteryModel || !advisorId) {
    ElMessage.warning('请填写 VIN、车型、电池型号和负责顾问')
    return
  }
  if (form.value.platePrefix && !PLATE_PREFIX_PATTERN.test(form.value.platePrefix.toUpperCase())) {
    ElMessage.warning('车牌前段格式应为：1 个汉字 + 1 个大写字母（如 粤B）')
    return
  }
  if (!editMode.value) {
    const name = form.value.ownerName.trim()
    const phone = form.value.ownerPhone.trim()
    if (!name || !phone) {
      ElMessage.warning('请填写车主姓名和手机号')
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      ElMessage.warning('请输入正确的 11 位手机号')
      return
    }
  }
  const payload: Partial<Vehicle> = {
    vin: form.value.vin.trim().toUpperCase(),
    advisorId,
    licensePlate: form.value.licensePlate,
    catalogId: form.value.catalogId || undefined,
    model: form.value.model,
    batteryModel: form.value.batteryModel,
    purchaseDate: form.value.purchaseDate || undefined,
    currentMileage: form.value.currentMileage,
    vehicleStatus: 'NORMAL',
  }
  if (editMode.value) {
    payload.ownerId = form.value.ownerId
    payload.nextMaintenanceDate = form.value.nextMaintenanceDate || undefined
    payload.nextInspectionDate = form.value.nextInspectionDate || undefined
    payload.insuranceExpireDate = form.value.insuranceExpireDate || undefined
    await vehicleApi.update(editingVin.value, payload, vehicleScopeParams.value)
  } else {
    payload.ownerName = form.value.ownerName.trim()
    payload.ownerPhone = form.value.ownerPhone.trim()
    await vehicleApi.create(payload, vehicleScopeParams.value)
  }
  dialogVisible.value = false
  ElMessage.success(editMode.value ? '车辆档案已更新' : '车辆档案已创建（已自动创建/关联车主）')
  await reloadVehicles()
  tableData.value = filterList()
}

async function removeVehicle(vehicle: Vehicle) {
  await ElMessageBox.confirm(`确认删除车辆 ${vehicle.licensePlate || vehicle.vin}？`, '删除车辆', {
    type: 'warning',
  })
  await vehicleApi.remove(vehicle.vin, vehicleScopeParams.value)
  ElMessage.success('车辆档案已删除')
  await reloadVehicles()
  tableData.value = filterList()
}

onMounted(async () => {
  if (can('vehicle', 'create') && isAdmin.value) {
    const users = await userApi.list()
    advisors.value = (users || []).filter((u) => u.role === 'ADVISOR' && u.status === 'ENABLED')
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader :title="userStore.isOwner ? '我的车辆' : isAdvisor ? '我的客户车辆' : '车辆档案'" :subtitle="pageSubtitle">
      <template v-if="can('vehicle', 'create')" #actions>
        <el-button type="primary" @click="openCreate">新增车辆档案</el-button>
      </template>
    </PageHeader>

    <div class="page-card">
      <div class="search-bar">
        <el-input v-model="keyword" placeholder="搜索 VIN / 车牌 / 车型" clearable style="width: 300px" @keyup.enter="handleSearch" />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>

      <el-empty v-if="tableData.length === 0" description="暂无车辆" />

      <el-row v-else :gutter="16">
        <el-col v-for="v in tableData" :key="v.vin" :span="8" style="margin-bottom: 16px">
          <div class="vehicle-card" @click="viewDetail(v.vin)">
            <div class="card-cover" :style="{ background: `linear-gradient(135deg, ${v.themeColor}22, #f5f5f5)` }">
              <VehicleCoverImage :catalog-id="v.catalogId" :alt="v.model" />
              <el-tag size="small" class="network-tag">{{ v.network }}</el-tag>
            </div>
            <div class="card-body">
              <h4>{{ v.model }}</h4>
              <p class="plate">{{ v.licensePlate }}</p>
              <p class="meta">{{ v.powertrain }} · {{ v.batteryModel }}</p>
              <div class="card-footer">
                <span>{{ v.currentMileage }} km</span>
                <el-tag :type="v.vehicleStatus === 'REPAIRING' ? 'warning' : 'success'" size="small">
                  {{ v.vehicleStatus === 'REPAIRING' ? '维修中' : '正常' }}
                </el-tag>
              </div>
              <p class="owner">
                车主：{{ v.ownerName || '未返回' }}
                <span v-if="v.ownerPhone"> · {{ v.ownerPhone }}</span>
              </p>
              <p v-if="!isAdvisor && v.advisorName" class="owner">顾问：{{ v.advisorName }}</p>
              <div v-if="can('vehicle', 'edit') || can('vehicle', 'delete')" class="card-actions" @click.stop>
                <el-button v-if="can('vehicle', 'edit')" link type="primary" @click="openEdit(v)">编辑</el-button>
                <el-button v-if="can('vehicle', 'delete')" link type="danger" @click="removeVehicle(v)">删除</el-button>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="dialogVisible" :title="editMode ? '编辑车辆档案' : '新增车辆档案'" width="560px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="VIN" required>
          <el-input v-model="form.vin" placeholder="17 位车架号" maxlength="17" :disabled="editMode" />
        </el-form-item>

        <template v-if="!editMode">
          <el-form-item label="车主姓名" required>
            <el-input v-model="form.ownerName" placeholder="如：张三" />
          </el-form-item>
          <el-form-item label="车主手机" required>
            <el-input v-model="form.ownerPhone" placeholder="11 位手机号" maxlength="11" />
          </el-form-item>
          <p class="form-hint">系统将按手机号自动创建或关联车主账号，默认密码 12345678</p>
        </template>
        <template v-else>
          <el-form-item label="车主">
            <el-input :model-value="`${form.ownerName || '-'} / ${form.ownerPhone || '-'}`" disabled />
          </el-form-item>
        </template>

        <el-form-item v-if="isAdmin" label="负责顾问" required>
          <el-select v-model="form.advisorId" placeholder="选择顾问" style="width: 100%">
            <el-option
              v-for="a in advisors"
              :key="a.userId"
              :label="`${a.realName}（${a.username}）`"
              :value="a.userId"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="车牌">
          <div style="display: flex; align-items: center; gap: 6px; width: 100%">
            <el-input
              v-model="form.platePrefix"
              placeholder="粤B"
              maxlength="2"
              style="width: 90px"
              @input="(v: string) => (form.platePrefix = v.toUpperCase())"
            />
            <span>·</span>
            <el-input v-model="form.plateNumber" placeholder="12345" maxlength="6" style="flex: 1" />
          </div>
          <p class="plate-hint">前段：汉字+大写字母（如 粤B）；后段：数字/字母，保存时自动补上中间的 "·"</p>
        </el-form-item>

        <el-form-item label="车型" required>
          <el-select
            v-model="form.model"
            placeholder="选择车型"
            filterable
            style="width: 100%"
            @change="onModelChange"
          >
            <el-option
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="电池型号" required>
          <el-select v-model="form.batteryModel" placeholder="选择电池型号" filterable style="width: 100%">
            <el-option
              v-for="item in batteryOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="购车日期">
          <el-date-picker v-model="form.purchaseDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="当前里程">
          <el-input-number v-model="form.currentMileage" :min="0" :step="100" style="width: 100%" />
        </el-form-item>

        <template v-if="editMode">
          <el-form-item label="下次保养">
            <el-date-picker v-model="form.nextMaintenanceDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="年检到期">
            <el-date-picker v-model="form.nextInspectionDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="保险到期">
            <el-date-picker v-model="form.insuranceExpireDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">{{ editMode ? '更新' : '保存' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.form-hint {
  margin: -8px 0 12px 100px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}

.plate-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}

.vehicle-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #f0f0f0;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .card-cover {
    position: relative;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .network-tag {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .card-body {
    padding: 16px;

    h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .plate {
      color: #e60012;
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .meta {
      font-size: 12px;
      color: #8c8c8c;
      margin-bottom: 12px;
    }

    .owner {
      font-size: 12px;
      color: #999;
      margin-top: 8px;
    }

    .card-actions {
      margin-top: 10px;
      display: flex;
      gap: 8px;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: #595959;
    }
  }
}
</style>
