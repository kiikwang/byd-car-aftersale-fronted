<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { faultApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { getServiceTypeConfig } from '@/constants/service-types'
import {
  buildFaultDescription,
  FAULT_QUICK_TAGS,
  FAULT_TYPE_OPTIONS,
  inferFaultType,
} from '@/utils/fault-form'
import type { Appointment } from '@/types'

const props = defineProps<{
  modelValue: boolean
  appointment: Appointment | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const submitting = ref(false)
const userStore = useUserStore()
const ownerDescription = ref('')
const form = ref({
  vin: '',
  faultType: '其他',
  faultLevel: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  advisorJudgment: '',
})

const serviceLabel = computed(() =>
  props.appointment ? getServiceTypeConfig(props.appointment.serviceType).label : '',
)

function resetForm() {
  const owner = props.appointment?.problemDescription?.trim() || ''
  ownerDescription.value = owner
  form.value = {
    vin: props.appointment?.vin || '',
    faultType: inferFaultType(owner),
    faultLevel: props.appointment?.serviceType === 'EMERGENCY_RESCUE' ? 'CRITICAL' : 'MEDIUM',
    advisorJudgment: owner,
  }
}

watch(
  () => [props.modelValue, props.appointment?.appointmentNo] as const,
  ([open]) => {
    if (open) resetForm()
  },
)

function addQuickTag(tag: string) {
  form.value.faultType = tag
  if (!form.value.advisorJudgment.includes(tag)) {
    form.value.advisorJudgment = form.value.advisorJudgment
      ? `${form.value.advisorJudgment}；${tag}`
      : tag
  }
}

async function submit() {
  if (!form.value.vin || !form.value.faultType) {
    ElMessage.warning('请填写故障现象')
    return
  }
  if (!form.value.advisorJudgment.trim()) {
    ElMessage.warning('请填写顾问判断')
    return
  }
  submitting.value = true
  try {
    await faultApi.create({
      vin: form.value.vin,
      appointmentId: props.appointment?.appointmentId,
      advisorId: userStore.userId,
      faultLevel: form.value.faultLevel,
      status: 'REGISTERED',
      faultDescription: buildFaultDescription({
        faultType: form.value.faultType,
        ownerDescription: ownerDescription.value,
        advisorJudgment: form.value.advisorJudgment,
      }),
    })
    ElMessage.success('故障登记成功')
    visible.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}

function closeLater() {
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="到店故障登记"
    width="600px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-alert
      v-if="appointment"
      :title="`预约单 ${appointment.appointmentNo} · 车主已到店，请核对现象并登记故障`"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-form :model="form" label-width="100px">
      <el-form-item label="预约单号">
        <el-input :model-value="appointment?.appointmentNo || '-'" disabled />
      </el-form-item>
      <el-form-item label="服务类型">
        <el-input :model-value="serviceLabel" disabled />
      </el-form-item>
      <el-form-item label="车辆 VIN">
        <el-input v-model="form.vin" disabled />
      </el-form-item>
      <el-form-item label="车主描述">
        <el-input
          :model-value="ownerDescription"
          type="textarea"
          :rows="3"
          disabled
          placeholder="车主预约时填写的问题描述"
        />
      </el-form-item>
      <el-form-item label="故障现象" required>
        <el-select v-model="form.faultType" placeholder="顾问归类故障现象" style="width: 100%">
          <el-option v-for="t in FAULT_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
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
          <el-tag
            v-for="tag in FAULT_QUICK_TAGS"
            :key="tag"
            style="cursor: pointer"
            @click="addQuickTag(tag)"
          >
            {{ tag }}
          </el-tag>
        </el-space>
      </el-form-item>
      <el-form-item label="顾问判断" required>
        <el-input
          v-model="form.advisorJudgment"
          type="textarea"
          :rows="4"
          placeholder="在车主描述基础上补充现场核实、归类判断（可修改原文）"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeLater">稍后登记</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存登记</el-button>
    </template>
  </el-dialog>
</template>
