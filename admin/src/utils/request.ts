import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { message } from 'ant-design-vue'

const instance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || '/api',
})

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const auth = useAuthStore()
    config.headers = config.headers ?? {}

    if (auth.token?.trim()) {
      config.headers.Authorization = `Bearer ${auth.token}`
    }

    return config
  },
  (error: any) => {
    message.error(`${error.code ?? 'request_error'}: ${error.message}`)
    return Promise.reject(error)
  },
)

instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data
    if (payload && typeof payload === 'object' && 'code' in payload && 'message' in payload && 'data' in payload) {
      const code = (payload as any).code
      const msg = (payload as any).message
      const data = (payload as any).data
      if (code && Number(code) !== 0) {
        message.error(String(msg || 'error'))
      }
      return data
    }
    return payload
  },
  (error: any) => {
    const status = error.response?.status
    if (status === 401) {
      message.error('unauthorized')
      router.push('/login')
    } else {
      const backendMsg = error.response?.data?.message
      if (backendMsg) {
        message.error(String(backendMsg))
      } else {
        message.error(`${error.code ?? 'response_error'}: ${error.message}`)
      }
    }
    return Promise.reject(error)
  },
)

export default instance
