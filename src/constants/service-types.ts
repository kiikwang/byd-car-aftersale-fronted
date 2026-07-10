import type { Appointment } from '@/types'

export const SERVICE_TYPE_OPTIONS: Array<{
  label: string
  value: Appointment['serviceType']
  type: 'success' | 'warning' | 'danger' | 'info'
  desc: string
  placeholder: string
}> = [
  {
    label: '定期保养',
    value: 'SCHEDULED_MAINTENANCE',
    type: 'success',
    desc: '按里程或周期进行常规维保、电池检查和车辆健诊。',
    placeholder: '如：2万公里保养、希望检查电池/制动/轮胎',
  },
  {
    label: '年检代办',
    value: 'ANNUAL_INSPECTION',
    type: 'info',
    desc: '协助年检资料检查、车辆检测准备和代办服务。',
    placeholder: '如：年检即将到期，需要门店协助代办',
  },
  {
    label: '故障维修',
    value: 'FAULT_REPAIR',
    type: 'warning',
    desc: '车辆异常、仪表报警、续航下降等，到店后进入诊断维修流程。',
    placeholder: '请描述故障现象，如报警信息、是否还能正常行驶',
  },
  {
    label: '紧急救援',
    value: 'EMERGENCY_RESCUE',
    type: 'danger',
    desc: '突发无法行驶、搭电、拖车或现场协助，门店会优先处理。',
    placeholder: '请写明当前位置、联系人电话、现场情况、是否需要拖车',
  },
]

export function getServiceTypeConfig(serviceType?: Appointment['serviceType']) {
  return SERVICE_TYPE_OPTIONS.find((item) => item.value === serviceType)
    || { label: serviceType || '未分类', type: 'info' as const, desc: '', placeholder: '请描述服务需求' }
}
