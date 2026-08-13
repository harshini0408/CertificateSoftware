import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const normalizeBasePath = (value) => {
  if (!value) return '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const apiTarget = process.env.VITE_DEV_BACKEND_ORIGIN || 'http://backend:8000'

// https://vitejs.dev/config/
export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH || '/'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/storage': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/static': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
