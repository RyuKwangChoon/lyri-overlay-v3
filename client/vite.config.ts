import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  console.log(`🌍 [Vite Mode]: ${mode}`)
  console.log(`🛰️  Gate URL: ${env.VITE_GATE_URL}`)
  console.log(`🛰️  Relay URL: ${env.VITE_RELAY_URL}`)
  console.log(`🔌 WS URL: ${env.VITE_WS_URL}`)

  return {
    plugins: [vue()],

    // ✅ Server 설정
    server: {
      port: 5173,
      strictPort: true,
      open: false,
      allowedHosts: ['overlay.lyrisudabang.com', 'localhost', '127.0.0.1'],
      proxy: {
        // Gate API (GPT 메시지)
        '/fromGpt': {
          target: env.VITE_GATE_URL || 'http://127.0.0.1:8788',
          changeOrigin: true,
          rewrite: (path) => path,
        },
        // Relay Server API
        '/api': {
          target: env.VITE_RELAY_URL || 'http://127.0.0.1:8787',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    // ✅ Alias 설정 (Import path 단축)
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
        '@views': fileURLToPath(new URL('./src/views', import.meta.url)),
        '@layers': fileURLToPath(new URL('./src/layers', import.meta.url)),
        '@store': fileURLToPath(new URL('./src/store', import.meta.url)),
        '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      },
    },

    // ✅ Build 옵션
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: false,
        },
        format: {
          comments: true,
        },
      },
      sourcemap: mode === 'development',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue'],
          },
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },

    // ✅ Define: 전역 상수 주입
    define: {
      __GATE_URL__: JSON.stringify(env.VITE_GATE_URL || 'http://127.0.0.1:8788'),
      __RELAY_URL__: JSON.stringify(env.VITE_RELAY_URL || 'http://127.0.0.1:8787'),
      __WS_URL__: JSON.stringify(env.VITE_WS_URL || 'ws://127.0.0.1:8787'),
      __CDN_URL__: JSON.stringify(env.VITE_CDN_URL || 'https://api.lyrisudabang.com/uploads'),
      __OVERLAY_VERSION__: JSON.stringify(env.VITE_OVERLAY_VERSION || '3.0.0'),
    },
  }
})
