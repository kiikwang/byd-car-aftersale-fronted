/** 解析故障描述中的车主/顾问分段 */
export interface ParsedFaultDescription {
  faultType: string
  ownerDescription: string
  advisorJudgment: string
  raw: string
}

export function parseFaultDescription(text: string): ParsedFaultDescription {
  const raw = text || ''
  let faultType = ''
  let ownerDescription = ''
  let advisorJudgment = ''

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('故障现象：')) {
      faultType = trimmed.slice('故障现象：'.length).trim()
    } else if (trimmed.startsWith('【车主描述】')) {
      ownerDescription = trimmed.slice('【车主描述】'.length).trim()
    } else if (trimmed.startsWith('【顾问判断】')) {
      advisorJudgment = trimmed.slice('【顾问判断】'.length).trim()
    }
  }

  if (!ownerDescription && !advisorJudgment && raw && !faultType) {
    ownerDescription = raw
  }

  return { faultType, ownerDescription, advisorJudgment, raw }
}

/** Agent 诊断输入：合并车主描述与顾问判断 */
export function buildAgentInputFromFault(faultDescription: string): string {
  const parsed = parseFaultDescription(faultDescription)
  const parts: string[] = []
  if (parsed.faultType) parts.push(`故障现象：${parsed.faultType}`)
  if (parsed.ownerDescription) parts.push(`车主描述：${parsed.ownerDescription}`)
  if (parsed.advisorJudgment) parts.push(`顾问判断：${parsed.advisorJudgment}`)
  return parts.join('\n') || parsed.raw
}

export const FAULT_TYPE_OPTIONS = [
  '快充变慢',
  '续航下降',
  '仪表报警',
  '电池温度异常',
  '充电中断',
  '压差过大',
  '其他',
] as const

export const FAULT_QUICK_TAGS = ['快充变慢', '续航下降', '仪表报警', '电池温度异常']

/** 根据车主描述粗匹配故障现象 */
export function inferFaultType(ownerDescription: string): string {
  const text = ownerDescription || ''
  for (const tag of FAULT_QUICK_TAGS) {
    if (text.includes(tag)) return tag
  }
  if (/制动|刹车|踏板/.test(text)) return '其他'
  if (/无法启动|启动/.test(text)) return '仪表报警'
  if (/充电|快充|慢充/.test(text)) return '快充变慢'
  return '其他'
}

/** 合成入库描述：保留车主原话 + 顾问二次判断 */
export function buildFaultDescription(params: {
  faultType: string
  ownerDescription: string
  advisorJudgment: string
}): string {
  const owner = params.ownerDescription.trim()
  const advisor = params.advisorJudgment.trim()
  const lines = [`故障现象：${params.faultType}`]
  if (owner) lines.push(`【车主描述】${owner}`)
  if (advisor) lines.push(`【顾问判断】${advisor}`)
  return lines.join('\n')
}
