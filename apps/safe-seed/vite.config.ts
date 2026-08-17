import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hfTarget =
    env.VITE_HF_API_URL ||
    env.HF_API_URL ||
    'https://adityamurthy-safe-seed-api.hf.space'
  const hfToken = env.VITE_HF_TOKEN || env.HF_TOKEN || ''
  const localBackend = env.VITE_LOCAL_BACKEND || ''

  // VITE_LOCAL_BACKEND → proxy /api and /demo/api to local uvicorn
  // Relative VITE_API_BASE (default /demo/api) → proxy to HF Space
  // Absolute VITE_API_BASE → no proxy (direct/CORS mode)
  const apiBase = env.VITE_API_BASE || '/demo/api'
  const useLocalBackend = Boolean(localBackend)
  const useHfProxy =
    !useLocalBackend && (!apiBase.startsWith('http://') && !apiBase.startsWith('https://'))

  const stripApiPrefix = (path: string) =>
    path.replace(/^\/demo\/api/, '').replace(/^\/api/, '') || '/'

  const attachHfHeaders = (proxy: any) => {
    proxy.on('proxyReq', (proxyReq: any, req: any) => {
      const origin = req.headers.origin
      if (origin && !String(origin).toLowerCase().includes('hf.space')) {
        proxyReq.setHeader('Origin', origin)
      }
      if (!hfToken) return
      const auth = req.headers['authorization']
      const ss = req.headers['x-safe-seed-token']
      // Move app JWT out of Authorization so HF gets the space token.
      if (!ss && auth && typeof auth === 'string' && !auth.includes('hf_')) {
        proxyReq.setHeader('X-Safe-Seed-Token', auth)
      }
      proxyReq.setHeader('Authorization', `Bearer ${hfToken}`)
    })
  }

  const localProxy = {
    target: localBackend,
    changeOrigin: true,
    timeout: 180_000,
    proxyTimeout: 180_000,
    rewrite: stripApiPrefix,
  }

  const hfProxy = {
    target: hfTarget,
    changeOrigin: true,
    secure: true,
    timeout: 180_000,
    proxyTimeout: 180_000,
    rewrite: stripApiPrefix,
    configure: attachHfHeaders,
  }

  const proxy = useLocalBackend
    ? { '/api': localProxy, '/demo/api': localProxy }
    : useHfProxy
      ? { '/api': hfProxy, '/demo/api': hfProxy }
      : {}

  return {
    base: '/demo/',
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy,
    },
  }
})
