<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import VehicleCoverImage from '@/components/VehicleCoverImage.vue'
import { useUserStore } from '@/stores/user'
import { usePermissions } from '@/composables/usePermissions'
import { useScopedVehicles, reloadVehicles } from '@/composables/useScopedVehicles'
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
const owners = ref<SysUser[]>([])
const advisors = ref<SysUser[]>([])
const form = ref({
  vin: '',
  ownerId: undefined as number | undefined,
  advisorId: undefined as number | undefined,
  licensePlate: '',
  model: '',
  batteryModel: '刀片电池',
  purchaseDate: '',
  currentMileage: 0,
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

function openCreate() {
  editMode.value = false
  editingVin.value = ''
  form.value = {
    vin: '',
    ownerId: owners.value[0]?.userId,
    advisorId: isAdvisor.value ? userStore.userId : advisors.value[0]?.userId,
    licensePlate: '',
    model: '',
    batteryModel: '刀片电池',
    purchaseDate: '',
    currentMileage: 0,
  }
  dialogVisible.value = true
}

function openEdit(vehicle: Vehicle) {
  editMode.value = true
  editingVin.value = vehicle.vin
  form.value = {
    vin: vehicle.vin,
    ownerId: vehicle.ownerId,
    advisorId: vehicle.advisorId,
    licensePlate: vehicle.licensePlate,
    model: vehicle.model,
    batteryModel: vehicle.batteryModel,
    purchaseDate: vehicle.purchaseDate,
    currentMileage: vehicle.currentMileage,
  }
  dialogVisible.value = true
}

async function submitCreate() {
  const advisorId = isAdvisor.value ? userStore.userId : form.value.advisorId
  if (!form.value.vin || !form.value.ownerId || !advisorId || !form.value.model) {
    ElMessage.warning(isAdvisor.value ? '请填写 VIN、车主和车型' : '请填写 VIN、车主、负责顾问和车型')
    return
  }
  const payload = {
    vin: form.value.vin.trim().toUpperCase(),
    ownerId: form.value.ownerId,
    advisorId,
    licensePlate: form.value.licensePlate,
    model: form.value.model,
    batteryModel: form.value.batteryModel,
    purchaseDate: form.value.purchaseDate || undefined,
    currentMileage: form.value.currentMileage,
    vehicleStatus: 'NORMAL',
  } as Vehicle
  if (editMode.value) {
    await vehicleApi.update(editingVin.value, payload, vehicleScopeParams.value)
  } else {
    await vehicleApi.create(payload, vehicleScopeParams.value)
  }
  dialogVisible.value = false
  ElMessage.success(editMode.value ? '车辆档案已更新' : '车辆档案已创建')
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
  if (can('vehicle', 'create')) {
    const users = await userApi.list()
    owners.value = (users || []).filter((u) => u.role === 'OWNER' && u.status === 'ENABLED')
    if (isAdmin.value) {
      advisors.value = (users || []).filter((u) => u.role === 'ADVISOR' && u.status === 'ENABLED')
    }
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

    <el-dialog v-model="dialogVisible" :title="editMode ? '编辑车辆档案' : '新增车辆档案'" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="VIN" required>
          <el-input v-model="form.vin" placeholder="17 位车架号" maxlength="17" :disabled="editMode" />
        </el-form-item>
        <el-form-item label="车主" required>
          <el-select v-model="form.ownerId" placeholder="选择车主" style="width: 100%">
            <el-option
              v-for="o in owners"
              :key="o.userId"
              :label="`${o.realName}（${o.username}）`"
              :value="o.userId"
            />
          </el-select>
        </el-form-item>
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
          <el-input v-model="form.licensePlate" placeholder="粤B·12345" />
        </el-form-item>
        <el-form-item label="车型" required>
          <el-input v-model="form.model" placeholder="汉 EV / 宋 PLUS DM-i / 海豚" />
        </el-form-item>
        <el-form-item label="电池型号">
          <el-input v-model="form.batteryModel" />
        </el-form-item>
        <el-form-item label="购车日期">
          <el-date-picker v-model="form.purchaseDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="当前里程">
          <el-input-number v-model="form.currentMileage" :min="0" :step="100" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">{{ editMode ? '更新' : '保存' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
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
