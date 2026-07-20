import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), tailwindcss()],

    define: {
      'process.env.API_URL': JSON.stringify(env.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:3000'),
      'process.env.APP_VERSION': JSON.stringify(process.env.npm_package_version),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      port: 5173,
      strictPort: false,
      open: true,
    },

    build: {
      target: 'ES2020',
      minify: 'terser',
      cssCodeSplit: true,
      sourcemap: process.env.VITE_SOURCE_MAP === 'true',
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-charts': ['recharts', 'chart.js'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-motion': ['motion'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },

    preview: {
      port: 4173,
      strictPort: false,
    },
  };
});
