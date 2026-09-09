import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Abraco1.png', 'Abraco5.png', 'Abraco10.png', 'Abraco11.png'],
      manifest: {
        name: 'Sabor de Abraço',
        short_name: 'Sabor de Abraço',
        description: 'Cafeteria e sistema de atendimento do Sabor de Abraço',
        theme_color: '#3a2015',
        background_color: '#f8efe7',
        start_url: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait',
        scope: '/',
        icons: [
          {
            src: '/Abraco1.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/Abraco1.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
})
