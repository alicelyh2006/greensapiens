import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this as a project site from /greensapiens/.
  // On Vercel or Netlify, which serve from the root, set this back to '/'.
  // Runtime data URLs follow this automatically — see BASE in src/lib/config.js.
  base: '/greensapiens/',

  // Stamps every URL under public/data with the build id — see STAMP in
  // src/lib/config.js. The bundle is content-hashed and always arrives fresh;
  // the data files are served with a ten-minute cache, so without this a
  // returning visitor can run a new deploy's code against the old data for
  // ten minutes after a push. During judging that window is not acceptable.
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
})
