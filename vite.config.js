import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // If deploying to GitHub Pages at /greensapiens/, set base to '/greensapiens/'.
  // Vercel and Netlify serve from the root, so leave it as '/'.
  base: '/',
})
