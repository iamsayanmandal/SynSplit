import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'logo.png', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'SynSplit - Smart Expense Manager',
        short_name: 'SynSplit',
        description: 'Pool money & split expenses effortlessly with friends.',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'date-fns', 'jspdf', 'jspdf-autotable']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  esbuild: {
    pure: ['console.log'],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
