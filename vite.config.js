import { defineConfig } from 'vite'
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
  define: {
    // sockjs-client가 사용하는 Node.js global 변수 폴리필
    global: 'globalThis',
  },
  server: {
    port: 3000,
    proxy: {
      // Go Middleware SSE 스트림 (직접 연결)
      '/api/watch/stream': {
        target: 'http://192.168.3.114:18081',
        changeOrigin: true,
      },
      // Spring Boot API (기존)
      '/api': {
        target: 'http://192.168.3.114:8080',
        changeOrigin: true,
      },
    },
  },
})
