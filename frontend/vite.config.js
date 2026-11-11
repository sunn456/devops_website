import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Запити /api/... під час розробки передаються серверній частині Django.
export default defineConfig({
  base: '/devops-website/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
