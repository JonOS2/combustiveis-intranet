import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // permite conexões de qualquer IP da sua máquina
    port: 5173,          // porta do seu dev server
    strictPort: true,    // se a porta estiver ocupada, não muda automaticamente
    allowedHosts: ['all', 'chamados.local'], // permite qualquer hostname da rede
  }
});
