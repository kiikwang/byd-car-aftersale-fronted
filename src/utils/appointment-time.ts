import { DEFAULT_BUSINESS_HOURS } from '@/constants/business-hours'

const { openHour, closeHour, slotMinutes, openOnSunday } = DEFAULT_BUSINESS_HOURS
const ALLOWED_MINUTES = [0, 15, 30, 45]

export function disabledAppointmentHours() {
  const hours: number[] = []
  for (let h = 0; h < 24; h += 1) {
    if (h < openHour || h >= closeHour) hours.push(h)
  }
  return hours
}

export function disabledAppointmentMinutes(hour: number) {
  if (hour < openHour || hour >= closeHour) {
    return Array.from({ length: 60 }, (_, i) => i)
  }
  return Array.from({ length: 60 }, (_, i) => i).filter((m) => !ALLOWED_MINUTES.includes(m))
}

export function disabledAppointmentSeconds() {
  return Array.from({ length: 60 }, (_, i) => i).filter((i) => i !== 0)
}

export function isSunday(date: Date) {
  return date.getDay() === 0
}

export function roundToQuarterHour(value: string) {
  if (!value) return value
  const normalized = value.replace('T', ' ')
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return value
  const [, day, hourText, minuteText] = match
  let hour = Number(hourText)
  let minute = Number(minuteText)
  minute = Math.round(minute / slotMinutes) * slotMinutes
  if (minute === 60) {
    minute = 0
    hour += 1
  }
  return `${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

export function validateAppointmentTime(value: string) {
  const rounded = roundToQuarterHour(value)
  const normalized = rounded.replace('T', ' ')
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return '请选择有效的预约时间'

  const [, , hourText, minuteText] = match
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const date = new Date(normalized.replace(' ', 'T'))

  if (!openOnSunday && isSunday(date)) {
    return '周日暂不营业，请选择其他日期'
  }
  if (hour < openHour || hour >= closeHour) {
    return `预约时间需在营业时间内（${String(openHour).padStart(2, '0')}:00-${String(closeHour).padStart(2, '0')}:00）`
  }
  if (!ALLOWED_MINUTES.includes(minute)) {
    return `预约时间须为每 ${slotMinutes} 分钟一档（如 09:00、09:15）`
  }
  if (hour === closeHour - 1 && minute > 45) {
    return `最晚预约时间为 ${String(closeHour - 1).padStart(2, '0')}:45`
  }
  return null
}
