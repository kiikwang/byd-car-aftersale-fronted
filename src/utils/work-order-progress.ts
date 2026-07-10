import type { WorkOrder } from '@/types'

export function getWorkOrderProgress(status?: WorkOrder['status']) {
  switch (status) {
    case 'CREATED':
      return 10
    case 'ASSIGNED':
      return 30
    case 'IN_PROGRESS':
      return 60
    case 'PART_WAITING':
      return 75
    case 'COMPLETED':
      return 100
    default:
      return 0
  }
}
