import catalogJson from '../data/vehicle-catalog.json'

export interface VehicleModelCatalog {
  modelCode: string
  series: string
  seriesEn: string
  displayName: string
  trim: string
  bodyType: 'SEDAN' | 'SUV' | 'HATCHBACK' | 'MPV'
  powerType: 'BEV' | 'PHEV' | 'DM-i'
  batteryModel: string
  rangeKm: number
  lengthMm: number
  wheelbaseMm: number
  msrpCny: number
  launchYear: number
  imageSide: string
  imageHero: string
  themeColor: string
  gradientStart: string
  gradientEnd: string
  tagline: string
}

export const vehicleCatalog = catalogJson.models as VehicleModelCatalog[]

export function getModelByCode(code: string) {
  return vehicleCatalog.find((m) => m.modelCode === code)
}

export function enrichVehicle<T extends { modelCode?: string; model?: string }>(vehicle: T) {
  const catalog = vehicle.modelCode ? getModelByCode(vehicle.modelCode) : undefined
  return {
    ...vehicle,
    catalog,
    fullModelName: catalog ? `${catalog.displayName} ${catalog.trim}` : vehicle.model,
    imageSide: catalog?.imageSide,
    themeColor: catalog?.themeColor,
    tagline: catalog?.tagline,
  }
}
