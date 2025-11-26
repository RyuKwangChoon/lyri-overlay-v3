import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [vue()],

    // 개발 서버 설정
    server: {
      port: 5173,
      host: true,        // LAN / OBS 접속 허용
      open: false,
      cors: true,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // 절대 경로 alias
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@overlay": path.resolve(__dirname, "src/overlay"),
        "@control": path.resolve(__dirname, "src/control"),
        "@modules": path.resolve(__dirname, "src/modules"),
        "@services": path.resolve(__dirname, "src/services"),
        "@themes": path.resolve(__dirname, "src/themes"),
      },
    },

    // 빌드 옵션
    build: {
      target: "esnext",
      outDir: "dist",
      sourcemap: mode === "development",
      emptyOutDir: true,
    },

    // Define: 전역 환경변수 주입
    define: {
      __VITE_MODE__: JSON.stringify(env.VITE_MODE),
      __API_BASE__: JSON.stringify(env.VITE_API_BASE),
      __WS_URL__: JSON.stringify(env.VITE_WS_URL),
    },
  }
})
