import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteSingleFile } from 'vite-plugin-singlefile'

const normalizeBasePath = (value) => {
  if (!value) return '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from the root or frontend directories
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_BACKEND_ORIGIN || env.VITE_API_URL || 'http://localhost:2849'

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    plugins: [react() , viteSingleFile()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 2848,
      strictPort: true,
      proxy: {
        ...Object.fromEntries(
          [
            '/api',
            '/auth',
            '/admin',
            '/clubs',
            '/coordinator',
            '/events',
            '/participants',
            '/templates',
            '/certificates',
            '/verify',
            '/student',
            '/students',
            '/tutor',
            '/dept',
            '/principal',
            '/hod',
            '/image-templates',
            '/guest',
            '/role-presets',
            '/affairs',
            '/certificate-config',
            '/storage',
            '/static',
            '/health',
          ].map((path) => [
            path,
            {
              target: apiTarget,
              changeOrigin: true,
            },
          ])
        ),
      },
    },
  }
})
