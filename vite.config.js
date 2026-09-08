import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this as a project site from /greensapiens/.
  // On Vercel or Netlify, which serve from the root, set this back to '/'.
  // Runtime data URLs follow this automatically — see BASE in src/lib/config.js.
  base: '/greensapiens/',
})
