import { defineStore } from 'pinia'

import { ref, computed } from 'vue'

import type { UserRole } from '@/constants/roles'

import { ROLE_CONFIG } from '@/constants/roles'

import { authApi } from '@/api'

import { resetVehicleCache } from '@/composables/useScopedVehicles'



function normalizeRole(roleValue: string): UserRole {

  if (roleValue === 'MANAGER') return 'SERVICE_MANAGER'

  return (ROLE_CONFIG as Record<string, unknown>)[roleValue] ? (roleValue as UserRole) : 'ADVISOR'

}



export const useUserStore = defineStore('user', () => {

  const token = ref(localStorage.getItem('token') || '')

  const username = ref(localStorage.getItem('username') || '')

  const realName = ref(localStorage.getItem('realName') || '')

  const role = ref<UserRole>((localStorage.getItem('role') as UserRole) || 'ADVISOR')

  const userId = ref(Number(localStorage.getItem('userId') || 0))

  const ownerId = ref<number | undefined>(

    localStorage.getItem('ownerId') ? Number(localStorage.getItem('ownerId')) : undefined,

  )



  const isLoggedIn = computed(() => !!token.value)

  const roleLabel = computed(() => ROLE_CONFIG[role.value]?.label || role.value)

  const allowedRoutes = computed(() => ROLE_CONFIG[role.value]?.routes || [])

  const isOwner = computed(() => role.value === 'OWNER')



  function applyProfile(payload: {

    token?: string

    userId: number

    username: string

    realName: string

    role: string

    ownerId?: number

  }) {

    const backendRole = normalizeRole(payload.role)

    if (payload.token) {

      token.value = payload.token

      localStorage.setItem('token', payload.token)

    }

    username.value = payload.username

    realName.value = payload.realName

    role.value = backendRole

    userId.value = payload.userId

    ownerId.value = payload.ownerId

    localStorage.setItem('username', username.value)

    localStorage.setItem('realName', realName.value)

    localStorage.setItem('role', role.value)

    localStorage.setItem('userId', String(userId.value))

    if (ownerId.value) {

      localStorage.setItem('ownerId', String(ownerId.value))

    } else {

      localStorage.removeItem('ownerId')

    }

  }



  async function login(name: string, pwd: string) {

    if (!name || !pwd) return false

    const payload = await authApi.login(name, pwd)

    applyProfile(payload)

    resetVehicleCache()

    return true

  }



  async function restoreSession() {

    if (!token.value) return false

    try {

      const payload = await authApi.me()

      applyProfile(payload)

      return true

    } catch {

      await logout()

      return false

    }

  }



  async function logout() {

    try {

      if (token.value) {

        await authApi.logout()

      }

    } catch {

      // ignore network errors during logout

    }

    token.value = ''

    username.value = ''

    realName.value = ''

    role.value = 'ADVISOR'

    userId.value = 0

    ownerId.value = undefined

    localStorage.removeItem('token')

    localStorage.removeItem('username')

    localStorage.removeItem('realName')

    localStorage.removeItem('role')

    localStorage.removeItem('userId')

    localStorage.removeItem('ownerId')

    resetVehicleCache()

  }



  return {

    token,

    username,

    realName,

    role,

    userId,

    ownerId,

    isLoggedIn,

    roleLabel,

    allowedRoutes,

    isOwner,

    applyProfile,

    login,

    restoreSession,

    logout,

  }

})


