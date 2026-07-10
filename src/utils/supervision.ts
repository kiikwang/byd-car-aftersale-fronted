export type SupervisionLog = {
  workOrderId?: number
  work_order_id?: number
  business_id?: number
  detail?: string
  createdAt?: string
}

export type SupervisionEntry = {
  workOrderId: number
  detail: string
  createdAt?: string
}

export function resolveLogWorkOrderId(log: SupervisionLog | Record<string, unknown>) {
  const raw = (log as SupervisionLog).workOrderId
    ?? (log as SupervisionLog).work_order_id
    ?? (log as SupervisionLog).business_id
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export function buildSupervisionMap(logs: Array<SupervisionLog | Record<string, unknown>>) {
  const map: Record<number, SupervisionEntry> = {}
  for (const log of logs || []) {
    const id = resolveLogWorkOrderId(log)
    if (id == null) continue
    map[id] = {
      workOrderId: id,
      detail: String((log as SupervisionLog).detail || '经理已督办，请尽快处理'),
      createdAt: (log as SupervisionLog).createdAt,
    }
  }
  return map
}

export function getSupervisionEntry(
  map: Record<number, SupervisionEntry>,
  workOrderId?: number | null,
) {
  if (workOrderId == null) return undefined
  return map[Number(workOrderId)]
}
