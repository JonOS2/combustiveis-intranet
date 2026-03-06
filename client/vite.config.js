import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['all'],

    // Proxy de desenvolvimento — redireciona /api para o backend
    // Assim não precisa de Docker para o frontend durante o desenvolvimento
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
