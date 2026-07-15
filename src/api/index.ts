import request from '@/utils/request'
import type { Vehicle, Appointment, FaultRecord, WorkOrder, Part, BatteryHealthRecord, VehicleHealthSnapshot, Settlement, SysUser, ServiceCenter, VehicleReminder } from '@/types'

export interface WorkOrderCreatePayload {
  faultId: number
  diagnosisId?: number
  technicianId?: number
  laborCost?: number
}

export interface WorkOrderCompletePayload {
  repairResult: string
  warrantyAmount?: number
  operatorId: number
}

export interface PartCreatePayload {
  partNo: string
  partName: string
  category?: string
  stockQuantity?: number
  warningThreshold?: number
  unit?: string
  purchasePrice?: number
  sellingPrice?: number
}

export interface PartUsagePayload {
  workOrderId: number
  partId: number
  quantity: number
  technicianId: number
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

export interface WarrantyEstimate {
  laborAmount: number
  partAmount: number
  grossAmount: number
  suggestedWarrantyAmount: number
  customerPayable: number
  vehicleInWarranty: boolean
  vehicleVin?: string
  vehicleAgeYears?: number
  vehicleMileage?: number
  notes?: string[]
}

export interface LoginResponsePayload {
  token: string
  userId: number
  username: string
  realName: string
  role: string
  ownerId?: number
}

async function unwrap<T>(promise: Promise<any>): Promise<T> {
  const res = await promise
  return (res?.data ?? res) as T
}

export type VehicleListParams = { advisorId?: number }

export const vehicleApi = {
  list: (params?: VehicleListParams) => unwrap<Vehicle[]>(request.get('/vehicles', { params })),
  getByVin: (vin: string, params?: VehicleListParams) => unwrap<Vehicle>(request.get(`/vehicles/${vin}`, { params })),
  create: (data: Partial<Vehicle>, params?: VehicleListParams) => unwrap<void>(request.post('/vehicles', data, { params })),
  update: (vin: string, data: Partial<Vehicle>, params?: VehicleListParams) => unwrap<void>(request.put(`/vehicles/${vin}`, data, { params })),
  remove: (vin: string, params?: VehicleListParams) => unwrap<void>(request.delete(`/vehicles/${vin}`, { params })),
}

export const appointmentApi = {
  list: () => unwrap<Appointment[]>(request.get('/appointments')),
  create: (data: Partial<Appointment>) => unwrap<void>(request.post('/appointments', data)),
  updateStatus: (appointmentNo: string, status: Appointment['status']) =>
    unwrap<void>(request.put(`/appointments/${appointmentNo}/status`, null, { params: { status } })),
  remove: (appointmentNo: string) => unwrap<void>(request.delete(`/appointments/${appointmentNo}`)),
}

export const faultApi = {
  list: () => unwrap<FaultRecord[]>(request.get('/fault-records')),
  listByVin: (vin: string) => unwrap<FaultRecord[]>(request.get(`/fault-records/vehicle/${vin}`)),
  create: (data: Partial<FaultRecord>) => unwrap<void>(request.post('/fault-records', data)),
  update: (faultNo: string, data: Partial<FaultRecord>) => unwrap<void>(request.put(`/fault-records/${faultNo}`, data)),
  remove: (faultNo: string) => unwrap<void>(request.delete(`/fault-records/${faultNo}`)),
}

export const workOrderApi = {
  list: () => unwrap<WorkOrder[]>(request.get('/work-orders')),
  listMine: (technicianId: number) => unwrap<WorkOrder[]>(request.get('/work-orders/my', { params: { technicianId } })),
  listSupervisions: (technicianId: number) => unwrap<Array<{ workOrderId: number; detail: string; createdAt: string }>>(request.get('/work-orders/supervisions', { params: { technicianId } })),
  getById: (id: number | string) => unwrap<WorkOrder>(request.get(`/work-orders/${id}`)),
  create: (payload: WorkOrderCreatePayload) => unwrap<WorkOrder>(request.post('/work-orders', payload)),
  assign: (id: number | string, technicianId: number) => unwrap<WorkOrder>(request.put(`/work-orders/${id}/assign`, { technicianId })),
  start: (id: number | string) => unwrap<WorkOrder>(request.put(`/work-orders/${id}/start`)),
  partsArrived: (id: number | string) => unwrap<WorkOrder>(request.put(`/work-orders/${id}/parts-arrived`)),
  partWaiting: (id: number | string) => unwrap<WorkOrder>(request.put(`/work-orders/${id}/part-waiting`)),
  updateLaborCost: (id: number | string, laborCost: number) => unwrap<WorkOrder>(request.put(`/work-orders/${id}/labor-cost`, { laborCost })),
  complete: (id: number | string, payload: WorkOrderCompletePayload) => unwrap<Settlement>(request.post(`/work-orders/${id}/complete`, payload)),
  warrantyEstimate: (id: number | string) => unwrap<WarrantyEstimate>(request.get(`/work-orders/${id}/warranty-estimate`)),
  supervise: (id: number | string, operatorId: number) => unwrap<void>(request.put(`/work-orders/${id}/supervise`, { operatorId })),
}

export const partsApi = {
  list: () => unwrap<Part[]>(request.get('/parts')),
  getById: (id: number | string) => unwrap<Part>(request.get(`/parts/${id}`)),
  create: (payload: PartCreatePayload) => unwrap<Part>(request.post('/parts', payload)),
  update: (id: number | string, payload: PartCreatePayload) => unwrap<Part>(request.put(`/parts/${id}`, payload)),
  remove: (id: number | string) => unwrap<void>(request.delete(`/parts/${id}`)),
  addStock: (id: number | string, quantity: number) => unwrap<Part>(request.post(`/parts/${id}/stock`, { quantity })),
  lowStockAlerts: () => unwrap<string[]>(request.get('/parts/alerts')),
}

export const partUsageApi = {
  apply: (payload: PartUsagePayload) => unwrap<PartUsageRecord>(request.post('/part-usages', payload)),
  listByWorkOrder: (workOrderId: number) => unwrap<PartUsageRecord[]>(request.get('/part-usages', { params: { workOrderId } })),
  listPending: () => unwrap<PartUsageRecord[]>(request.get('/part-usages')),
  listAll: () => unwrap<PartUsageRecord[]>(request.get('/part-usages', { params: { scope: 'all' } })),
  countToday: () => unwrap<{ todayApplications: number }>(request.get('/part-usages/stats/today')),
  approve: (usageId: number, approvedBy: number) => unwrap<PartUsageRecord>(request.put(`/part-usages/${usageId}/approve`, { approvedBy })),
  reject: (usageId: number, approvedBy: number) => unwrap<PartUsageRecord>(request.put(`/part-usages/${usageId}/reject`, { approvedBy })),
}

export const batteryApi = {
  list: (level?: string) => unwrap<BatteryHealthRecord[]>(request.get('/battery-alerts', { params: { level } })),
  create: (data: Partial<BatteryHealthRecord>) => unwrap<BatteryHealthRecord>(request.post('/battery-alerts', data)),
  remind: (vin: string, operatorId: number) => unwrap<void>(request.post(`/battery-alerts/${vin}/remind`, { operatorId })),
}

export const vehicleHealthApi = {
  latestByOwner: (ownerId: number) =>
    unwrap<VehicleHealthSnapshot[]>(request.get('/vehicle-health/latest', { params: { ownerId } })),
  historyByVin: (vin: string) =>
    unwrap<VehicleHealthSnapshot[]>(request.get(`/vehicle-health/vehicle/${vin}`)),
  createSnapshot: (data: Partial<VehicleHealthSnapshot>) =>
    unwrap<VehicleHealthSnapshot>(request.post('/vehicle-health/snapshots', data)),
}

export const reminderApi = {
  listByOwner: (ownerId: number) => unwrap<VehicleReminder[]>(request.get('/reminders', { params: { ownerId } })),
  markRead: (id: number, ownerId: number) => unwrap<void>(request.put(`/reminders/${id}/read`, null, { params: { ownerId } })),
}

export const settlementApi = {
  list: () => unwrap<Settlement[]>(request.get('/settlements')),
  getById: (id: number | string) => unwrap<Settlement>(request.get(`/settlements/${id}`)),
  getByWorkOrder: (workOrderId: number) => unwrap<Settlement>(request.get(`/settlements/work-order/${workOrderId}`)),
  pay: (id: number | string) => unwrap<Settlement>(request.put(`/settlements/${id}/pay`)),
  approve: (id: number | string, operatorId: number) => unwrap<Settlement>(request.put(`/settlements/${id}/approve`, { operatorId })),
  reject: (id: number | string, operatorId: number) => unwrap<Settlement>(request.put(`/settlements/${id}/reject`, { operatorId })),
}

export const agentApi = {
  diagnose: (data: { vin?: string; faultDesc: string; faultId?: number }) =>
    unwrap<any>(request.post('/agent/diagnose', data)),
  listByFault: (faultId: number) => unwrap<any[]>(request.get(`/agent/fault/${faultId}`)),
}

export const dashboardApi = {
  stats: () => unwrap<any>(request.get('/dashboard/stats')),
}

export const userApi = {
  list: () => unwrap<SysUser[]>(request.get('/users')),
  create: (data: Partial<SysUser>) => unwrap<void>(request.post('/users', data)),
  update: (id: number, data: Partial<SysUser>) => unwrap<void>(request.put(`/users/${id}`, data)),
  resetPassword: (id: number) => unwrap<void>(request.put(`/users/${id}/reset-password`)),
}

export const serviceCenterApi = {
  list: () => unwrap<ServiceCenter[]>(request.get('/service-centers')),
}

export const authApi = {
  login: (username: string, password: string) =>
    unwrap<LoginResponsePayload>(request.post('/auth/login', { username, password })),
  register: (data: {
    username: string
    password: string
    realName: string
    phone: string
    vin: string
    licensePlate: string
    model: string
    batteryModel?: string
    purchaseDate?: string
    currentMileage?: number
    advisorId?: number
  }) => unwrap<LoginResponsePayload>(request.post('/auth/register', data)),
  advisors: () => unwrap<{ advisorId: number; realName: string }[]>(request.get('/auth/advisors')),
  me: () => unwrap<Omit<LoginResponsePayload, 'token'>>(request.get('/auth/me')),
  logout: () => unwrap<void>(request.post('/auth/logout')),
}
