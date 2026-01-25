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
    return response.data
  },
  (error: any) => {
    const status = error.response?.status
    if (status === 401) {
      message.error('unauthorized')
      router.push('/login')
    } else {
      message.error(`${error.code ?? 'response_error'}: ${error.message}`)
    }
    return Promise.reject(error)
  },
)

export default instance
