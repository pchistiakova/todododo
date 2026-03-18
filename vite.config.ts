import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'fs'

function copyElectronAssets(): Plugin {
  return {
    name: 'copy-electron-assets',
    writeBundle() {
      const assets = ['capture.html', 'tray-icon.png']
      for (const file of assets) {
        const src = path.resolve(__dirname, 'electron', file)
        const dest = path.resolve(__dirname, 'dist-electron', file)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
          plugins: [copyElectronAssets()],
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        entry: 'electron/capture-preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
