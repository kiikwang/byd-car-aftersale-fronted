<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  map?: Record<string, { label: string; type: '' | 'success' | 'warning' | 'danger' | 'info' }>
}>()

const defaultMap: Record<string, { label: string; type: '' | 'success' | 'warning' | 'danger' | 'info' }> = {
  // appointment
  PENDING: { label: '待确认', type: 'warning' },
  CONFIRMED: { label: '已确认', type: 'success' },
  CANCELLED: { label: '已取消', type: 'info' },
  ARRIVED: { label: '已到店', type: '' },
  COMPLETED: { label: '已完成', type: 'info' },
  // fault
  REGISTERED: { label: '已登记', type: 'warning' },
  DIAGNOSED: { label: '已诊断', type: 'success' },
  WORK_ORDER_CREATED: { label: '已建工单', type: '' },
  CLOSED: { label: '已关闭', type: 'info' },
  // work order
  CREATED: { label: '待派工', type: 'warning' },
  ASSIGNED: { label: '已派工', type: '' },
  IN_PROGRESS: { label: '正在维修', type: 'warning' },
  PART_WAITING: { label: '待备件', type: 'warning' },
  // COMPLETED / CANCELLED 与预约共用；工单详情通过 :map 覆盖为「维修完成」
  // part request
  PROPOSED: { label: '待备件员审批', type: 'warning' },
  APPLIED: { label: '待备件员审批', type: 'warning' },
  APPROVED: { label: '备件已审批', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
  USED: { label: '已出库', type: 'success' },
  RETURNED: { label: '已退库', type: 'info' },
  // battery
  NORMAL: { label: '正常', type: 'success' },
  WARNING: { label: '预警', type: 'warning' },
  DANGER: { label: '异常', type: 'danger' },
  // settlement
  UNPAID: { label: '待支付', type: 'warning' },
  PAID: { label: '已支付', type: 'success' },
  REFUNDED: { label: '已退款', type: 'info' },
  PENDING_APPROVAL: { label: '待经理审核', type: 'warning' },
  // legacy lowercase
  pending: { label: '待处理', type: 'warning' },
  confirmed: { label: '已确认', type: 'success' },
  completed: { label: '已完成', type: 'info' },
  cancelled: { label: '已取消', type: 'info' },
  open: { label: '待诊断', type: 'warning' },
  diagnosed: { label: '已诊断', type: 'success' },
  closed: { label: '已关闭', type: 'info' },
  assigned: { label: '已派工', type: '' },
  repairing: { label: '维修中', type: 'warning' },
  done: { label: '已完工', type: 'success' },
  normal: { label: '正常', type: 'success' },
  warning: { label: '预警', type: 'warning' },
  danger: { label: '异常', type: 'danger' },
  draft: { label: '草稿', type: 'info' },
}

const config = computed(() => {
  const m = props.map || defaultMap
  return m[props.status] || { label: props.status, type: 'info' as const }
})
</script>

<template>
  <el-tag :type="config.type" effect="light" round>{{ config.label }}</el-tag>
</template>
