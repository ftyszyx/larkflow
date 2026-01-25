import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import router from '@/router'
import { useContextStore } from '@/stores/context'
import { message } from 'ant-design-vue'

const instance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || '/api',
})

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const ctx = useContextStore()
    config.headers = config.headers ?? {}

    for (const [k, v] of Object.entries(ctx.headers)) {
      config.headers[k] = v
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
      router.push('/settings')
    } else {
      message.error(`${error.code ?? 'response_error'}: ${error.message}`)
    }
    return Promise.reject(error)
  },
)

export default instance
