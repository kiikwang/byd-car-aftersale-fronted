import type { Vehicle } from '@/types'
import { catalogMap, getCatalogImageCandidates } from '@/data/vehicle-catalog'

const MODEL_CATALOG_MAP: Record<string, string> = {
  'han ev': 'han-ev-zhijia',
  '汉 ev': 'han-ev-zhijia',
  'seal ev': 'seal-ev-2025',
  '海豹 2025': 'seal-ev-2025',
  '海豹07': 'seal07-dmi',
  'seal07': 'seal07-dmi',
  'song plus': 'song-plus-dmi',
  '宋plus': 'song-plus-dmi',
  'tang dm': 'tang-dmi',
  '唐 dm': 'tang-dmi',
  'dolphin': 'dolphin-zhijia',
  '海豚': 'dolphin-zhijia',
  'yuan plus': 'yuan-plus',
  '元plus': 'yuan-plus',
  'qin plus': 'qin-plus-dmi',
  '秦plus': 'qin-plus-dmi',
  '海狮': 'seal-ev-2025',
  '护卫舰': 'seal07-dmi',
  '驱逐舰': 'qin-plus-dmi',
}

function resolveCatalogId(model?: string): string | undefined {
  if (!model) return undefined
  const key = model.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const [pattern, catalogId] of Object.entries(MODEL_CATALOG_MAP)) {
    if (key.includes(pattern)) return catalogId
  }
  return undefined
}

export function enrichVehicle(raw: Vehicle): Vehicle {
  const catalogId = raw.catalogId || resolveCatalogId(raw.model)
  const catalog = catalogId ? catalogMap[catalogId] : undefined
  const coverImage = catalogId
    ? getCatalogImageCandidates(catalogId)[0] || '/vehicles/default.svg'
    : '/vehicles/default.svg'
  return {
    ...raw,
    catalogId: catalogId || raw.catalogId || '',
    coverImage,
    themeColor: raw.themeColor || catalog?.themeColor || '#e60012',
    network: raw.network || catalog?.network || '王朝网',
    powertrain: raw.powertrain || catalog?.powertrain || 'BEV',
    // 保留顾问录入/选择的车型名，避免未知车型被错误改写成目录默认名
    model: raw.model || catalog?.displayName || '',
    batteryModel: raw.batteryModel || catalog?.batteryType || raw.batteryModel,
    currentMileage: Number(raw.currentMileage) || 0,
  }
}

export function enrichVehicles(list: Vehicle[]): Vehicle[] {
  return (list || []).map(enrichVehicle)
}
