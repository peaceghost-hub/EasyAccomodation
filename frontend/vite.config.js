import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep behavior unchanged; only relax the warning threshold for large chunks like mapbox-gl
    chunkSizeWarningLimit: 2000, // KB
  },
})
