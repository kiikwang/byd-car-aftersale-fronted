export const PART_CATEGORY_MAP: Record<string, string> = {
  BATTERY: '电池系统',
  MOTOR: '驱动电机',
  BRAKE: '制动系统',
  TIRE: '轮胎系统',
  ELECTRIC: '电气系统',
  HIGH_VOLTAGE: '高压系统',
  CHARGING: '充电系统',
  BODY: '车身附件',
  OTHER: '其他',
}

export const PART_CATEGORY_OPTIONS = Object.entries(PART_CATEGORY_MAP).map(([value, label]) => ({
  value,
  label,
}))

export function partCategoryLabel(category?: string) {
  if (!category) return '-'
  return PART_CATEGORY_MAP[category] || category
}
