import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dedupe React so libraries that ship their own copy (lucide-react,
  // drei, etc.) resolve to the same module instance as the app. Without
  // this Vite's pre-bundling can produce two copies of React, which
  // surfaces as "Invalid hook call" warnings the moment a lib renders.
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['lucide-react']
  },
  server: { port: 5173 }
})
