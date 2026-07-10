import type { Vehicle } from '@/types'
import { catalogMap, getCatalogImageCandidates } from '@/data/vehicle-catalog'

const MODEL_CATALOG_MAP: Record<string, string> = {
  'han ev': 'han-ev-zhijia',
  '汉 ev': 'han-ev-zhijia',
  'seal ev': 'seal-ev-2025',
  '海豹': 'seal-ev-2025',
  'seal07': 'seal07-dmi',
  'song plus': 'song-plus-dmi',
  '宋plus': 'song-plus-dmi',
  'tang': 'tang-dmi',
  '唐': 'tang-dmi',
  'dolphin': 'dolphin-zhijia',
  '海豚': 'dolphin-zhijia',
  'yuan plus': 'yuan-plus',
  '元plus': 'yuan-plus',
  'qin plus': 'qin-plus-dmi',
  '秦plus': 'qin-plus-dmi',
}

function resolveCatalogId(model?: string): string {
  if (!model) return 'han-ev-zhijia'
  const key = model.trim().toLowerCase()
  for (const [pattern, catalogId] of Object.entries(MODEL_CATALOG_MAP)) {
    if (key.includes(pattern)) return catalogId
  }
  return 'han-ev-zhijia'
}

export function enrichVehicle(raw: Vehicle): Vehicle {
  const catalogId = raw.catalogId || resolveCatalogId(raw.model)
  const catalog = catalogMap[catalogId]
  const coverImage = getCatalogImageCandidates(catalogId)[0] || '/vehicles/default.svg'
  return {
    ...raw,
    catalogId,
    coverImage,
    themeColor: raw.themeColor || catalog?.themeColor || '#e60012',
    network: raw.network || catalog?.network || '王朝网',
    powertrain: raw.powertrain || catalog?.powertrain || 'BEV',
    model: catalog ? catalog.displayName : raw.model,
    batteryModel: raw.batteryModel || catalog?.batteryType || raw.batteryModel,
    currentMileage: Number(raw.currentMileage) || 0,
  }
}

export function enrichVehicles(list: Vehicle[]): Vehicle[] {
  return (list || []).map(enrichVehicle)
}
