import type { VehicleReminder } from '@/types'

export function getReminderLevelConfig(reminder: Pick<VehicleReminder, 'level'>) {
  if (reminder.level === 'DANGER') return { label: '紧急', type: 'danger' as const }
  if (reminder.level === 'WARNING') return { label: '提醒', type: 'warning' as const }
  return { label: '提示', type: 'info' as const }
}
