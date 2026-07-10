import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { hasRouteAccess } from '@/constants/roles'
import type { UserRole } from '@/constants/roles'
import { ElMessage } from 'element-plus'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/register/index.vue'),
    meta: { title: '注册', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '统计看板', icon: 'DataAnalysis' },
      },
      {
        path: 'vehicle',
        name: 'Vehicle',
        component: () => import('@/views/vehicle/index.vue'),
        meta: { title: '车辆档案', icon: 'Van' },
      },
      {
        path: 'vehicle/:vin',
        name: 'VehicleDetail',
        component: () => import('@/views/vehicle/detail.vue'),
        meta: { title: '车辆详情', hidden: true },
      },
      {
        path: 'appointment',
        name: 'Appointment',
        component: () => import('@/views/appointment/index.vue'),
        meta: { title: '车主预约', icon: 'Calendar' },
      },
      {
        path: 'service-center',
        name: 'ServiceCenter',
        component: () => import('@/views/service-center/index.vue'),
        meta: { title: '服务中心', icon: 'Location' },
      },
      {
        path: 'fault',
        name: 'Fault',
        component: () => import('@/views/fault/index.vue'),
        meta: { title: '故障登记', icon: 'Warning' },
      },
      {
        path: 'agent',
        name: 'Agent',
        component: () => import('@/views/agent/index.vue'),
        meta: { title: 'Agent 诊断', icon: 'Cpu' },
      },
      {
        path: 'work-order',
        name: 'WorkOrder',
        component: () => import('@/views/work-order/index.vue'),
        meta: { title: '维修工单', icon: 'Document' },
      },
      {
        path: 'work-order/:id',
        name: 'WorkOrderDetail',
        component: () => import('@/views/work-order/detail.vue'),
        meta: { title: '工单详情', hidden: true },
      },
      {
        path: 'parts',
        name: 'Parts',
        component: () => import('@/views/parts/index.vue'),
        meta: { title: '备件库存', icon: 'Box' },
      },
      {
        path: 'battery',
        name: 'Battery',
        component: () => import('@/views/battery/index.vue'),
        meta: { title: '车辆健康', icon: 'Lightning' },
      },
      {
        path: 'settlement',
        name: 'Settlement',
        component: () => import('@/views/settlement/index.vue'),
        meta: { title: '维修结算', icon: 'Money' },
      },
      {
        path: 'system',
        name: 'System',
        component: () => import('@/views/system/users.vue'),
        meta: { title: '用户权限', icon: 'Setting' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '系统'} - 比亚迪售后智能维修管理系统`
  const token = localStorage.getItem('token')
  if (!to.meta.public && !token) {
    next('/login')
    return
  }
  if (to.path === '/login' && token) {
    next('/dashboard')
    return
  }
  if (to.path === '/register' && token) {
    next('/dashboard')
    return
  }
  if (!to.meta.public && token) {
    const role = (localStorage.getItem('role') || 'ADVISOR') as UserRole
    const path = to.path
    if (!hasRouteAccess(role, path)) {
      ElMessage.warning('当前角色无权访问该页面')
      next('/dashboard')
      return
    }
  }
  next()
})

export default router
