import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function syncDistPlugin() {
  return {
    name: 'sync-dist-plugin',
    closeBundle() {
      try {
        const clientDist = path.resolve(__dirname, 'dist')
        const rootDist = path.resolve(__dirname, '../dist')
        if (fs.existsSync(clientDist)) {
          if (!fs.existsSync(rootDist)) {
            fs.mkdirSync(rootDist, { recursive: true })
          }
          fs.cpSync(clientDist, rootDist, { recursive: true })

          const entryCode = `export default function handler(req, res) {\n  res.writeHead(200, { 'Content-Type': 'text/html' });\n  res.end('Mock Examination Platform UI Ready');\n}\n`;
          fs.writeFileSync(path.join(clientDist, 'index.js'), entryCode);
          fs.writeFileSync(path.join(rootDist, 'index.js'), entryCode);
          
          console.log('[sync-dist-plugin] Successfully synchronized client/dist -> root/dist with entrypoint')
        }
      } catch (err) {
        console.warn('[sync-dist-plugin] Warning copying dist:', err.message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    syncDistPlugin()
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
})
