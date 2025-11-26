import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  console.log(`🌍 [Vite Mode]: ${mode}`)
  console.log(`🛰️  API Base: ${env.VITE_API_BASE}`)
  console.log(`🔌  WS URL: ${env.VITE_WS_URL}`)

  return {
    plugins: [    
      vue(),
    ],
    // ✅ server 설정을 하나로 통합
    server: {
      port: 8787,
      allowedHosts: ['overlay.lyrisudabang.com'], // Cloudflare 터널 허용
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://127.0.0.1:8787',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: 'terser', // ✅ esbuild 대신 terser 사용
      terserOptions: {
        compress: {
          drop_console: false,   // ✅ 로그 유지
          drop_debugger: false,
        },
        format: {
          comments: true,
        },
      },
      sourcemap: true, // 디버깅 시 소스 맵 표시
    },
    define: {
      __VITE_WS_URL__: JSON.stringify(env.VITE_WS_URL),
      __VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE),
    },
  }
})
