import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // onnxruntime-web (local Generate PoC) loads its WASM/worker artifacts
      // dynamically at runtime — esbuild's default dep-scan mishandles that
      // pattern, so it needs to sit outside pre-bundling. worker.format
      // defaults to 'iife' in dev, which onnxruntime-web's worker code
      // doesn't expect; 'es' matches its actual build output.
      optimizeDeps: {
        exclude: ['onnxruntime-web'],
      },
      worker: {
        format: 'es',
      },
    };
});
