import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      // Go Middleware SSE 스트림 (직접 연결)
      '/api/watch/stream': {
        target: 'http://localhost:18081',
        changeOrigin: true,
      },
      // Spring Boot API (기존)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
