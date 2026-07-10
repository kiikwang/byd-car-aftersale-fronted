import type { Part } from '@/types'

/** 解析后端 /parts/alerts 返回的字符串，如 partId=3, name=xxx, stock=2 */
export function parseLowStockPartIds(alerts: string[]): number[] {
  return alerts
    .map((alert) => {
      const match = alert.match(/partId=(\d+)/)
      return match ? Number(match[1]) : null
    })
    .filter((id): id is number => id !== null)
}

export function filterLowStockParts(parts: Part[], alerts: string[]): Part[] {
  const ids = new Set(parseLowStockPartIds(alerts))
  if (ids.size === 0) {
    return parts.filter((p) => p.stockQuantity < p.warningThreshold)
  }
  return parts.filter((p) => p.partId != null && ids.has(p.partId))
}
