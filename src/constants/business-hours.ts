/** 售后门店默认营业时间（可按门店扩展） */
export const DEFAULT_BUSINESS_HOURS = {
  /** 每日开始（含） */
  openHour: 8,
  /** 每日结束（不含，即最晚预约 17:45） */
  closeHour: 18,
  /** 预约时间步长（分钟） */
  slotMinutes: 15,
  /** 周日是否营业 */
  openOnSunday: true,
} as const

export const BUSINESS_HOURS_LABEL = `${String(DEFAULT_BUSINESS_HOURS.openHour).padStart(2, '0')}:00 - ${String(DEFAULT_BUSINESS_HOURS.closeHour - 1).padStart(2, '0')}:45`

/** 预约弹窗提示文案 */
export const APPOINTMENT_TIME_HINT = '营业时间为8：00-17：45 不分节假日工作日'
