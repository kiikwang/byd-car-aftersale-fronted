/** 数据表字段对齐的类型定义 */

export type UserRole =
  | 'OWNER'
  | 'ADVISOR'
  | 'TECHNICIAN'
  | 'PART_ADMIN'
  | 'SERVICE_MANAGER'
  | 'ADMIN'

export interface SysUser {
  userId: number
  username: string
  realName: string
  phone: string
  role: UserRole
  status: 'ENABLED' | 'DISABLED'
}

export interface ServiceCenter {
  centerId: number
  centerName: string
  city: string
  address: string
  phone: string
  status: 'OPEN' | 'CLOSED'
}

export interface Vehicle {
  vin: string
  ownerId: number
  advisorId: number
  licensePlate: string
  /** 关联车型目录 catalogId */
  catalogId: string
  model: string
  batteryModel: string
  purchaseDate: string
  lastMaintenanceDate?: string
  nextMaintenanceDate?: string
  nextInspectionDate?: string
  insuranceExpireDate?: string
  currentMileage: number
  vehicleStatus: 'NORMAL' | 'REPAIRING' | 'SCRAPPED'
  ownerName?: string
  ownerPhone?: string
  advisorName?: string
  /** 封面图路径（由 catalogId 解析） */
  coverImage?: string
  themeColor?: string
  network?: string
  powertrain?: string
}

export interface Appointment {
  appointmentId?: number
  appointmentNo: string
  vin: string
  ownerId: number
  centerId: number
  centerName?: string
  appointmentTime: string
  serviceType: 'SCHEDULED_MAINTENANCE' | 'ANNUAL_INSPECTION' | 'FAULT_REPAIR' | 'EMERGENCY_RESCUE'
  problemDescription: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ARRIVED' | 'COMPLETED'
  ownerName?: string
}

export interface FaultRecord {
  faultId?: number
  faultNo: string
  appointmentId?: number
  vin: string
  advisorId?: number
  faultDescription: string
  faultLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'REGISTERED' | 'DIAGNOSED' | 'WORK_ORDER_CREATED' | 'CLOSED'
  ownerName?: string
  advisorName?: string
  licensePlate?: string
  model?: string
  createdAt?: string
  faultType?: string
}

export interface AgentDiagnosis {
  diagnosisId?: number
  faultId: number
  inputText: string
  diagnosisSuggestion: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  recommendedChecks: string
  confidenceScore?: number
}

export interface BatteryHealthRecord {
  batteryRecordId?: number
  vin: string
  soh: number
  chargeCycles: number
  maxTemperature: number
  minTemperature?: number
  voltageDiff: number
  warningLevel: 'NORMAL' | 'WARNING' | 'DANGER'
  detectTime: string
}

export interface VehicleHealthItem {
  itemId?: number
  snapshotId?: number
  itemType:
    | 'BATTERY'
    | 'TIRE_PRESSURE'
    | 'BRAKE'
    | 'LOW_VOLTAGE_BATTERY'
    | 'CHARGING_SYSTEM'
    | 'THERMAL_MANAGEMENT'
    | 'MAINTENANCE'
    | 'INSPECTION_INSURANCE'
    | string
  itemName: string
  level: 'NORMAL' | 'WARNING' | 'DANGER'
  metricValue?: string
  description?: string
  actionSuggestion?: string
  createdAt?: string
}

export interface VehicleHealthSnapshot {
  snapshotId?: number
  vin: string
  healthScore: number
  overallLevel: 'NORMAL' | 'WARNING' | 'DANGER'
  summary: string
  suggestion?: string
  detectTime: string
  createdAt?: string
  vehicle?: Vehicle
  items: VehicleHealthItem[]
}

export interface VehicleReminder {
  reminderId: number
  reminderNo: string
  vin: string
  ownerId: number
  reminderType: 'MAINTENANCE_DUE' | 'INSPECTION_DUE' | 'INSURANCE_DUE' | 'BATTERY_ALERT' | 'PAYMENT_DUE' | 'WORK_ORDER_UPDATE'
  level: 'INFO' | 'WARNING' | 'DANGER'
  title: string
  content?: string
  dueTime?: string
  status: 'UNREAD' | 'READ' | 'DONE'
  createdAt?: string
}

export interface WorkOrder {
  workOrderId?: number
  workOrderNo: string
  faultId?: number
  diagnosisId?: number
  technicianId?: number
  vin: string
  faultType?: string
  technician?: string
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'PART_WAITING' | 'COMPLETED' | 'CANCELLED'
  laborCost?: number
  repairResult?: string
  progress?: number
  createdAt?: string
  startedAt?: string
  finishedAt?: string
  updatedAt?: string
}

export interface Part {
  partId?: number
  partNo: string
  partName: string
  category: string
  stockQuantity: number
  warningThreshold: number
  unit?: string
  purchasePrice?: number
  sellingPrice?: number
}

export interface PartUsageRecord {
  usageId: number
  workOrderId: number
  partId: number
  quantity: number
  unitPrice: number
  technicianId: number
  approvedBy?: number
  status: 'PROPOSED' | 'APPLIED' | 'APPROVED' | 'REJECTED' | 'USED' | 'RETURNED'
  createdAt: string
  approvedAt?: string
}

export interface Settlement {
  settlementId?: number
  settlementNo: string
  workOrderId: number
  vin: string
  laborAmount: number
  partAmount: number
  warrantyAmount: number
  totalAmount: number
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED'
  /** 经理审核：顾问生成后需经理审批才可通知车主支付 */
  managerStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  ownerName?: string
}

export interface ManagerTodo {
  id: string
  type: 'WORK_ORDER_STUCK' | 'SETTLEMENT_REVIEW' | 'BATTERY_ALERT' | 'PART_SHORTAGE' | 'APPOINTMENT_OVERDUE'
  title: string
  desc: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  relatedId?: string
  actionLabel?: string
  actionPath?: string
}

export interface PartRequest {
  requestNo: string
  workOrderNo: string
  partNo: string
  partName: string
  quantity: number
  technicianId: number
  technicianName: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export interface DiagnosisResult {
  suggestion: string
  risks: string[]
  recommendedTests: string[]
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  faultId?: number
  diagnosisId?: number
}
