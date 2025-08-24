import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      stream: fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url)),
      http: fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url)),
      https: fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url)),
      url: fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url)),
      zlib: fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url)),
    },
  },
})
