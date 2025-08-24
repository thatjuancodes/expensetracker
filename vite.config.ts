import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      stream: '/src/shims/empty.ts',
      http: '/src/shims/empty.ts',
      https: '/src/shims/empty.ts',
      url: '/src/shims/empty.ts',
      zlib: '/src/shims/empty.ts',
    },
  },
})
