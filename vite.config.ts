import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isNetlify = process.env.NETLIFY === 'true';
  
  return {
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
      include: ['@supabase/supabase-js', 'antd', 'react-router-dom']
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // 生产环境禁用sourcemap以减少构建复杂性
      sourcemap: !isProduction,
      // 确保JavaScript模块正确输出
      assetsInlineLimit: 0,
      commonjsOptions: {
        transformMixedEsModules: true
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'antd']
          },
          // 确保输出的文件有正确的扩展名
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]'
        }
      },
      // 禁用警告限制
      chunkSizeWarningLimit: 1500,
      // 在Vercel环境下使用更简单的压缩
      minify: isProduction ? 'esbuild' : 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true
        }
      }
    },
    ssr: {
      // 禁用严格模式可能解决某些DOM操作兼容性问题
      noExternal: ['@supabase/supabase-js']
    }
  }
})