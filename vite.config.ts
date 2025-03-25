import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5182,
    open: true,
    cors: true
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  },
  build: {
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'antd']
        }
      }
    }
  },
  ssr: {
    // 禁用严格模式可能解决某些DOM操作兼容性问题
    noExternal: ['@supabase/supabase-js']
  }
})