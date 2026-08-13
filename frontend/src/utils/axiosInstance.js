import axios from 'axios'

const APP_BASE_URL = import.meta.env.BASE_URL || '/'

const ensureLeadingSlash = (value = '') => (value.startsWith('/') ? value : `/${value}`)
const removeTrailingSlash = (value = '') => value.replace(/\/+$/, '')

const appBasePrefix = removeTrailingSlash(ensureLeadingSlash(APP_BASE_URL))
const fallbackApiUrl = `${appBasePrefix === '' ? '' : appBasePrefix}/api`

export const BACKEND_URL = removeTrailingSlash(
  import.meta.env.VITE_API_URL || fallbackApiUrl,
)

const deriveBackendBaseUrl = () => {
  const explicit = removeTrailingSlash(import.meta.env.VITE_BACKEND_BASE_URL || '')
  if (explicit) return explicit
  if (BACKEND_URL.endsWith('/api')) {
    return removeTrailingSlash(BACKEND_URL.slice(0, -4))
  }
  return ''
}

export const BACKEND_BASE_URL = deriveBackendBaseUrl()

export const toBackendUrl = (path = '') => {
  if (!path) return BACKEND_BASE_URL || '/'
  if (/^https?:\/\//i.test(path)) return path
  if (!path.startsWith('/')) return `${BACKEND_BASE_URL}/${path}`
  return `${BACKEND_BASE_URL}${path}`
}

const loginPath = `${APP_BASE_URL}login`

const axiosInstance = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,          // send httpOnly cookies automatically
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request interceptor ────────────────────────────────────────────────────
// Cookies are sent automatically — nothing to inject.
axiosInstance.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
)

// ─── Response interceptor ────────────────────────────────────────────────────
// Track whether a refresh is already in flight so we don't loop.
let isRefreshing = false
let failedQueue = []

const processQueue = (error) => {
  const queue = failedQueue
  failedQueue = []
  queue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const requestUrl = originalRequest?.url || ''
    const isAuthMeRequest = requestUrl.includes('/auth/me')

    // ── 403 Forbidden ────────────────────────────────────────────────────────
    if (error.response?.status === 403) {
      // Lazy import to avoid circular dependency at module load time.
      const { useToastStore } = await import('../store/uiStore')
      const detail = error?.response?.data?.detail
      useToastStore.getState().addToast({
        type: 'error',
        message: detail || 'Access denied. You do not have permission to perform this action.',
      })
      return Promise.reject(error)
    }

    // ── 401 Unauthorized ─────────────────────────────────────────────────────
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !isAuthMeRequest
    ) {
      if (isRefreshing) {
        // Queue the request until refresh completes.
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => axiosInstance(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await axiosInstance.post('/auth/refresh')
        processQueue(null)
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)

        // Refresh failed — clear auth state. Avoid full-page reload loops.
        const { useAuthStore } = await import('../store/authStore')
        const { default: queryClient } = await import('./queryClient')
        useAuthStore.getState().clearAuth()
        queryClient.clear()
        if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
          window.history.replaceState(null, '', loginPath)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default axiosInstance
