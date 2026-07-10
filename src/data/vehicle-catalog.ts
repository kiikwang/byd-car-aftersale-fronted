/** AUTO-GENERATED from shared/vehicle-catalog.json - do not edit manually */

export interface VehicleCatalogItem {
  catalogId: string
  series: string
  network: string
  displayName: string
  trim: string
  powertrain: 'BEV' | 'DM-i' | 'DM-p'
  bodyType: string
  batteryType: string
  batteryCapacity: string
  nedcRange: string
  fastCharge: string
  themeColor: string
  imageKey: string
  msrp: string
}

export const VEHICLE_CATALOG: VehicleCatalogItem[] = [
  {
    "catalogId": "han-ev-zhijia",
    "series": "汉",
    "network": "王朝网",
    "displayName": "汉 EV 智驾版",
    "trim": "701KM激光雷达智驾型",
    "powertrain": "BEV",
    "bodyType": "sedan-flagship",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "85.44 kWh",
    "nedcRange": "701 km",
    "fastCharge": "800V 快充",
    "themeColor": "#8b1a1a",
    "imageKey": "han-ev",
    "msrp": "23.58万起"
  },
  {
    "catalogId": "seal-ev-2025",
    "series": "海豹",
    "network": "海洋网",
    "displayName": "海豹 2025款 EV",
    "trim": "650km四驱智驾版",
    "powertrain": "BEV",
    "bodyType": "sedan-sport",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "82.56 kWh",
    "nedcRange": "650 km",
    "fastCharge": "e平台3.0 Evo 快充",
    "themeColor": "#1e3a5f",
    "imageKey": "seal-ev",
    "msrp": "17.58万起"
  },
  {
    "catalogId": "seal07-dmi",
    "series": "海豹",
    "network": "海洋网",
    "displayName": "海豹07 DM-i 智驾版",
    "trim": "125KM精英型",
    "powertrain": "DM-i",
    "bodyType": "sedan-sport",
    "batteryType": "磷酸铁锂小电池 + 第五代DM",
    "batteryCapacity": "18.3 kWh",
    "nedcRange": "综合续航超1200km",
    "fastCharge": "交流慢充/直流补能",
    "themeColor": "#1a4d6e",
    "imageKey": "seal07-dmi",
    "msrp": "13.98万起"
  },
  {
    "catalogId": "song-plus-dmi",
    "series": "宋PLUS",
    "network": "海洋网",
    "displayName": "宋PLUS DM-i 智驾版",
    "trim": "112KM尊荣型",
    "powertrain": "DM-i",
    "bodyType": "suv",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "18.3 kWh",
    "nedcRange": "综合续航超1500km",
    "fastCharge": "交流慢充",
    "themeColor": "#2d5016",
    "imageKey": "song-plus-dmi",
    "msrp": "11.98万起"
  },
  {
    "catalogId": "tang-dmi",
    "series": "唐",
    "network": "王朝网",
    "displayName": "唐 DM-i 智驾版",
    "trim": "115KM旗舰型",
    "powertrain": "DM-i",
    "bodyType": "suv-large",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "21.5 kWh",
    "nedcRange": "综合续航超1100km",
    "fastCharge": "交流慢充",
    "themeColor": "#3d2b1f",
    "imageKey": "tang-dmi",
    "msrp": "17.98万起"
  },
  {
    "catalogId": "dolphin-zhijia",
    "series": "海豚",
    "network": "海洋网",
    "displayName": "海豚 智驾版",
    "trim": "420KM活力版",
    "powertrain": "BEV",
    "bodyType": "hatch",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "44.9 kWh",
    "nedcRange": "420 km",
    "fastCharge": "直流快充",
    "themeColor": "#0d7377",
    "imageKey": "dolphin",
    "msrp": "9.98万起"
  },
  {
    "catalogId": "yuan-plus",
    "series": "元PLUS",
    "network": "王朝网",
    "displayName": "元PLUS 智驾版",
    "trim": "510KM领先型",
    "powertrain": "BEV",
    "bodyType": "suv-compact",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "60.48 kWh",
    "nedcRange": "510 km",
    "fastCharge": "直流快充",
    "themeColor": "#5c4d7a",
    "imageKey": "yuan-plus",
    "msrp": "11.98万起"
  },
  {
    "catalogId": "qin-plus-dmi",
    "series": "秦PLUS",
    "network": "王朝网",
    "displayName": "秦PLUS DM-i 智驾版",
    "trim": "120KM领先型",
    "powertrain": "DM-i",
    "bodyType": "sedan",
    "batteryType": "刀片电池（磷酸铁锂）",
    "batteryCapacity": "18.3 kWh",
    "nedcRange": "综合续航超1245km",
    "fastCharge": "交流慢充",
    "themeColor": "#4a3728",
    "imageKey": "qin-plus-dmi",
    "msrp": "7.98万起"
  }
]

export const catalogMap = Object.fromEntries(VEHICLE_CATALOG.map((m) => [m.catalogId, m]))

export const catalogImageExt: Record<string, string> = {
  "han-ev-zhijia": "svg",
  "seal-ev-2025": "svg",
  "seal07-dmi": "svg",
  "song-plus-dmi": "svg",
  "tang-dmi": "svg",
  "dolphin-zhijia": "svg",
  "yuan-plus": "svg",
  "qin-plus-dmi": "svg"
}

export function getCatalogImage(catalogId: string): string {
  const item = catalogMap[catalogId]
  if (!item) return '/vehicles/default.svg'
  const ext = catalogImageExt[catalogId] || 'svg'
  return `/vehicles/${item.imageKey}.${ext}`
}

export function getCatalogImageCandidates(catalogId: string): string[] {
  const item = catalogMap[catalogId]
  if (!item) return ['/vehicles/default.svg']
  const k = item.imageKey
  return [`/vehicles/${k}.svg`, `/vehicles/${k}.png`, `/vehicles/${k}.jpg`]
}
