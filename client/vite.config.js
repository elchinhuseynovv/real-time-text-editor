import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // TODO: remove this once demo is done
    // hmr: {
    //   host: 'e8da0fb9bf43.ngrok-free.app', // Your ngrok host
    //   clientPort: 443, // HTTPS port
    // },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
})
