import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // sockjs-client가 사용하는 Node.js global 변수 폴리필
    global: 'globalThis',
  },
  server: {
    port: 3000,
    proxy: {
      // Go Middleware SSE 스트림 (직접 연결)
      '/api/watch/stream': {
        target: 'http://localhost:18081',
        changeOrigin: true,
      },
      // SSH WebSocket 프록시
      '/ws/ssh': {
        target: 'ws://localhost:8082',
        ws: true,
      },
      // Spring Boot API (기존)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
