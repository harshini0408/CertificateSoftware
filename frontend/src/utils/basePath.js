function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return ''
  }

  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
}

const configuredBasePath = normalizeBasePath(import.meta.env.VITE_APP_BASE_PATH?.trim())

export const APP_BASE_PATH = configuredBasePath || (
  typeof window !== 'undefined' && window.location.pathname.startsWith('/CertificateFrontend')
    ? '/CertificateFrontend'
    : ''
)

export function withBasePath(pathname) {
  if (!APP_BASE_PATH) {
    return pathname
  }

  if (!pathname) {
    return APP_BASE_PATH
  }

  return pathname.startsWith('/')
    ? `${APP_BASE_PATH}${pathname}`
    : `${APP_BASE_PATH}/${pathname}`
}