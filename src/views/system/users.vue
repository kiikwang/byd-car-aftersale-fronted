<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { userApi } from '@/api'
import { ROLE_LIST, type UserRole } from '@/constants/roles'
import type { SysUser } from '@/types'

const tableData = ref<SysUser[]>([])
const dialogVisible = ref(false)
const form = ref({
  username: '',
  realName: '',
  phone: '',
  role: 'ADVISOR' as UserRole,
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
})

function openCreate() {
  form.value = { username: '', realName: '', phone: '', role: 'ADVISOR', status: 'ENABLED' }
  dialogVisible.value = true
}

function submitForm() {
  if (!form.value.username || !form.value.realName) {
    ElMessage.warning('请填写账号与姓名')
    return
  }
  userApi.create({
    username: form.value.username,
    realName: form.value.realName,
    phone: form.value.phone,
    role: form.value.role,
    status: form.value.status,
    password: '12345678',
  } as any).then(async () => {
    dialogVisible.value = false
    ElMessage.success('用户已创建')
    tableData.value = await userApi.list()
  })
}

function toggleStatus(row: SysUser) {
  const next = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  userApi.update(row.userId, { ...row, status: next } as any).then(() => {
    row.status = next
    ElMessage.success(row.status === 'ENABLED' ? '已启用' : '已禁用')
  })
}

function resetPassword(row: SysUser) {
  userApi.resetPassword(row.userId).then(() => {
    ElMessage.success(`已重置 ${row.username} 的密码为 12345678`)
  })
}

function roleLabel(role: UserRole) {
  return ROLE_LIST.find((r) => r.value === role)?.label || role
}

onMounted(async () => {
  tableData.value = await userApi.list()
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="用户权限管理" subtitle="账号创建、角色分配与启用/禁用">
      <template #actions>
        <el-button type="primary" @click="openCreate">新建用户</el-button>
      </template>
    </PageHeader>

    <div class="page-card">
      <el-table :data="tableData" stripe>
        <el-table-column prop="userId" label="用户ID" width="90" />
        <el-table-column prop="username" label="登录账号" width="120" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机" width="130" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag effect="plain">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="row.status" :map="{ ENABLED: { label: '启用', type: 'success' }, DISABLED: { label: '禁用', type: 'danger' } }" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="toggleStatus(row)">
              {{ row.status === 'ENABLED' ? '禁用' : '启用' }}
            </el-button>
            <el-button link type="warning" @click="resetPassword(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="新建用户" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="登录账号">
          <el-input v-model="form.username" placeholder="username" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.realName" placeholder="real_name" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="form.phone" placeholder="phone" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="r in ROLE_LIST" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="ENABLED">启用</el-radio>
            <el-radio value="DISABLED">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
