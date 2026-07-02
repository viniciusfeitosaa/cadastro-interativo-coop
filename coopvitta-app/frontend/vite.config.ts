import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// COOPVITTA: SPA na raiz — sem landing estática.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const base = env.VITE_APP_BASE?.trim() || '/';

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      strictPort: false,
      proxy: {
        '/api': {
          target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err, _req, _res) => {
              console.warn('[proxy] Backend em', process.env.VITE_API_TARGET || 'http://127.0.0.1:3001', '— certifique-se de que o backend está rodando (ex: cd backend && npm run dev).', err.message);
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
