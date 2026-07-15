import { VEHICLE_CATALOG } from '@/data/vehicle-catalog'

/** 车辆档案 — 常见车型（顾问新建时下拉选择） */
export const VEHICLE_MODEL_OPTIONS = [
  ...VEHICLE_CATALOG.map((item) => ({
    value: item.displayName,
    label: item.displayName,
    catalogId: item.catalogId,
    defaultBattery: item.batteryType,
    network: item.network,
    powertrain: item.powertrain,
  })),
  { value: '汉 EV', label: '汉 EV', catalogId: 'han-ev', defaultBattery: '刀片电池 A1 型', network: '王朝网', powertrain: 'BEV' },
  { value: '海狮 07 EV', label: '海狮 07 EV', catalogId: 'sealion07-ev', defaultBattery: '刀片电池 B2 型', network: '海洋网', powertrain: 'BEV' },
  { value: '秦 PLUS EV', label: '秦 PLUS EV', catalogId: 'qin-plus-ev', defaultBattery: '刀片电池 A3 型', network: '王朝网', powertrain: 'BEV' },
  { value: '海豹 EV', label: '海豹 EV', catalogId: 'seal-ev', defaultBattery: '刀片电池 B2 型', network: '海洋网', powertrain: 'BEV' },
  { value: '唐 EV', label: '唐 EV', catalogId: 'tang-ev', defaultBattery: '刀片电池 B3 型', network: '王朝网', powertrain: 'BEV' },
  { value: '护卫舰 07 DM-i', label: '护卫舰 07 DM-i', catalogId: 'destroyer07-dmi', defaultBattery: '刀片电池 DM1 型', network: '海洋网', powertrain: 'DM-i' },
  { value: '驱逐舰 05 DM-i', label: '驱逐舰 05 DM-i', catalogId: 'destroyer05-dmi', defaultBattery: '刀片电池 DM2 型', network: '海洋网', powertrain: 'DM-i' },
]

/** 车辆档案 — 刀片电池常见型号 */
export const BATTERY_MODEL_OPTIONS = [
  '刀片电池 A1 型',
  '刀片电池 A3 型',
  '刀片电池 B2 型',
  '刀片电池 B3 型',
  '刀片电池 DM1 型',
  '刀片电池 DM2 型',
  '刀片电池（磷酸铁锂）',
  '磷酸铁锂小电池 + 第五代DM',
]

export function findModelOption(model: string) {
  return VEHICLE_MODEL_OPTIONS.find((item) => item.value === model)
}
