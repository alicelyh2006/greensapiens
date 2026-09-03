import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // If deploying to GitHub Pages at /greensapiens/, set base to '/greensapiens/'.
  // Vercel and Netlify serve from the root, so leave it as '/'.
  base: '/',
  build: {
    rollupOptions: {
      // Spike page is a separate entry so it never ships in production unless
      // you explicitly build it. Delete spike.html to kill it entirely.
      input: {
        main:       'index.html',
        lampUpload: 'LampUpload.html',
        reportForm: 'ReportForm.html',
      },
    },
  },
})
