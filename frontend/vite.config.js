import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // /storage/* → backend static file server so dev doesn't need CORS for images.
      // NOTE: All API calls use axiosInstance with baseURL = http://localhost:8000
      // directly (no /api prefix), so no API proxy is needed here.
      '/storage': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
