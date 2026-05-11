import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// size-sensor ResizeObserver.disconnect() 버그 패치
function sizeSensorPatch() {
  return {
    name: 'size-sensor-patch',
    transform(code, id) {
      if (id.includes('size-sensor') && id.includes('resizeObserver')) {
        return code.replace(
          'sensor.disconnect()',
          'sensor && sensor.disconnect()'
        );
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [sizeSensorPatch(), react(), tailwindcss()],
  resolve: {
    alias: {
      // Feature-Sliced 레이어 alias (docs/architecture-target.md 참조)
      '@app':      fileURLToPath(new URL('./src/app', import.meta.url)),
      '@pages':    fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@shared':   fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@stores':   fileURLToPath(new URL('./src/stores', import.meta.url)),
      // legacy (마이그레이션 종료 시 제거)
      '@':         fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // sockjs-client가 사용하는 Node.js global 변수 폴리필
    global: 'globalThis',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // SSH WebSocket 프록시
      '/ws/ssh': {
        target: 'ws://192.168.3.114:8082',
        ws: true,
      },
      // SFTP API (SSH 서버와 같은 포트)
      '/api/sftp': {
        target: 'http://192.168.3.114:8082',
        changeOrigin: true,
      },
      // WebSocket (알림) - 운영 백엔드
      '/ws': {
        target: 'ws://192.168.3.114:8080',
        ws: true,
        changeOrigin: true,
      },
      // Spring Boot API - 운영 백엔드
      '/api': {
        target: 'http://192.168.3.114:8080',
        changeOrigin: true,
      },
    },
  },
})
