import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Electron loads the renderer from a local file in production,
  // so built asset URLs must stay relative instead of /assets/...
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
