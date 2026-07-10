<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { serviceCenterApi } from '@/api'
import type { ServiceCenter } from '@/types'

const tableData = ref<ServiceCenter[]>([])

onMounted(async () => {
  tableData.value = await serviceCenterApi.list()
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="服务中心" subtitle="比亚迪售后门店信息" />

    <div class="page-card">
      <el-table :data="tableData" stripe>
        <el-table-column prop="centerName" label="门店名称" min-width="180" />
        <el-table-column prop="city" label="城市" width="110" />
        <el-table-column prop="address" label="地址" show-overflow-tooltip />
        <el-table-column prop="phone" label="电话" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="row.status" :map="{ OPEN: { label: '营业中', type: 'success' }, CLOSED: { label: '已关闭', type: 'danger' } }" />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
