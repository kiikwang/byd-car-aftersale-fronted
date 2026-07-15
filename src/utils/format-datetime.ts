export function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').replace(/\.\d+$/, '')
}

export function formatLicensePlate(plate?: string) {
  if (!plate) return ''
  if (plate.includes('·')) return plate
  const match = plate.match(/^([\u4e00-\u9fa5][A-Z])([A-Z0-9]+)$/)
  if (match) return `${match[1]}·${match[2]}`
  return plate
}
