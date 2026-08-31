import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode'

export default defineConfig({
  plugins: [react(), qrcode()],
  server: {
    host: true,            // bind to 0.0.0.0 — accessible on LAN
    port: 3000,
    strictPort: false,
    watch: {
      usePolling: true,    // fixes UNKNOWN watch error on Windows
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',  // must be 127.0.0.1, not 0.0.0.0
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000
      }
    }
  }
})
