<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api'
import { VEHICLE_CATALOG } from '@/data/vehicle-catalog'
import { reloadVehicles, resetVehicleCache } from '@/composables/useScopedVehicles'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  realName: '',
  phone: '',
  vin: '',
  licensePlate: '',
  catalogId: '',
  batteryModel: '',
})

/** 注册页推荐车型：汉 EV、海豹、宋 PLUS 等 */
const POPULAR_CATALOG_IDS = ['han-ev-zhijia', 'seal-ev-2025', 'song-plus-dmi', 'tang-dmi', 'dolphin-zhijia']

const modelOptions = computed(() => {
  const popular = POPULAR_CATALOG_IDS
    .map((id) => VEHICLE_CATALOG.find((c) => c.catalogId === id))
    .filter(Boolean) as typeof VEHICLE_CATALOG
  const rest = VEHICLE_CATALOG.filter((c) => !POPULAR_CATALOG_IDS.includes(c.catalogId))
  return [...popular, ...rest]
})

function onModelChange(catalogId: string) {
  const item = VEHICLE_CATALOG.find((c) => c.catalogId === catalogId)
  if (item) {
    form.value.batteryModel = item.batteryType
  }
}

const selectedModelName = computed(() =>
  VEHICLE_CATALOG.find((c) => c.catalogId === form.value.catalogId)?.displayName || '',
)

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/

async function handleRegister() {
  const { username, password, confirmPassword, realName, phone, vin, licensePlate, catalogId } = form.value
  if (!username || !password || !realName || !phone || !vin || !licensePlate || !catalogId) {
    ElMessage.warning('请填写完整注册信息（含车辆信息）')
    return
  }
  const normalizedVin = vin.trim().toUpperCase()
  if (!VIN_PATTERN.test(normalizedVin)) {
    ElMessage.warning('VIN 须为 17 位，且不能包含 I、O、Q')
    return
  }
  if (password.length < 6) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  if (password !== confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    const payload = await authApi.register({
      username,
      password,
      realName,
      phone,
      vin: normalizedVin,
      licensePlate: licensePlate.trim(),
      model: selectedModelName.value,
      batteryModel: form.value.batteryModel || undefined,
    })
    resetVehicleCache()
    userStore.applyProfile(payload)
    await reloadVehicles()
    ElMessage.success('注册成功，已绑定您的爱车并自动登录')
    await router.push('/dashboard')
  } catch (e: any) {
    ElMessage.error(e?.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <h2>车主注册</h2>
      <p class="hint">注册即绑定首台爱车，完成后可直接预约维保、查看维修进度</p>

      <el-form :model="form" label-position="top" @submit.prevent="handleRegister">
        <el-divider content-position="left">账号信息</el-divider>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="建议使用手机号或拼音账号" />
        </el-form-item>
        <el-form-item label="真实姓名">
          <el-input v-model="form.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="11 位手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirmPassword" type="password" show-password />
        </el-form-item>

        <el-divider content-position="left">我的爱车（首台）</el-divider>
        <el-form-item label="VIN 车架号" required>
          <el-input
            v-model="form.vin"
            placeholder="17 位车架号"
            maxlength="17"
            show-word-limit
            @input="form.vin = form.vin.toUpperCase()"
          />
        </el-form-item>
        <el-form-item label="车牌号" required>
          <el-input v-model="form.licensePlate" placeholder="如：粤B12345" />
        </el-form-item>
        <el-form-item label="车型" required>
          <el-select
            v-model="form.catalogId"
            placeholder="选择车型"
            style="width: 100%"
            filterable
            @change="onModelChange"
          >
            <el-option
              v-for="item in modelOptions"
              :key="item.catalogId"
              :label="`${item.displayName} · ${item.network}`"
              :value="item.catalogId"
            />
          </el-select>
        </el-form-item>

        <el-button type="primary" class="submit-btn" :loading="loading" @click="handleRegister">
          注册并绑定车辆
        </el-button>
      </el-form>

      <p class="back-link">
        已有账号？
        <router-link to="/login">返回登录</router-link>
      </p>
      <p class="vin-tip">车辆已在门店登记？请直接联系顾问绑定，勿重复注册 VIN</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
  padding: 24px;
}

.register-card {
  width: 440px;
  max-height: 95vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);

  h2 {
    margin-bottom: 6px;
    font-size: 22px;
  }

  .hint {
    color: #8c8c8c;
    font-size: 13px;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .submit-btn {
    width: 100%;
    height: 42px;
    margin-top: 8px;
    background: #e60012;
    border-color: #e60012;
  }

  .back-link {
    margin-top: 16px;
    text-align: center;
    font-size: 13px;
    color: #8c8c8c;

    a {
      color: #e60012;
      text-decoration: none;
      margin-left: 4px;
    }
  }

  .vin-tip {
    margin-top: 10px;
    text-align: center;
    font-size: 12px;
    color: #bfbfbf;
    line-height: 1.4;
  }
}
</style>
