import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

interface BackendResult<T> {
  code: number
  message: string
  data: T
}

type RequestInstance = AxiosInstance & {
  get<T = unknown>(url: string, config?: unknown): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<T>
  delete<T = unknown>(url: string, config?: unknown): Promise<T>
}

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

request.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

;(request.interceptors.response.use as any)(
  (response: AxiosResponse) => {
    const payload = response.data as BackendResult<unknown> | unknown
    if (payload && typeof payload === 'object' && 'code' in payload && 'message' in payload && 'data' in payload) {
      const wrapped = payload as BackendResult<unknown>
      if (wrapped.code !== 200) {
        ElMessage.error(wrapped.message || '请求失败')
        return Promise.reject(new Error(wrapped.message || '请求失败'))
      }
      return wrapped.data
    }
    return payload
  },
  (error: any) => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    }
    ElMessage.error(msg)
    return Promise.reject(error)
  },
)

export default request as RequestInstance
