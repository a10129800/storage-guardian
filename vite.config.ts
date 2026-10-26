import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateMultiResIco } from './scripts/createAppIcon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure Windows multi-resolution icon files exist on disk before Vite build
const publicIcon = path.resolve(__dirname, 'public/icon.ico');
const buildIcon = path.resolve(__dirname, 'build/icon.ico');
if (!fs.existsSync(publicIcon) || !fs.existsSync(buildIcon)) {
  try {
    fs.mkdirSync(path.resolve(__dirname, 'public'), { recursive: true });
    fs.mkdirSync(path.resolve(__dirname, 'build'), { recursive: true });
    const buf = generateMultiResIco();
    fs.writeFileSync(publicIcon, buf);
    fs.writeFileSync(buildIcon, buf);
  } catch {}
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
          },
        },
      },
      {
        onstart(args) {
          // Notify the Renderer process to reload the page when the Preload scripts build is complete
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
            rollupOptions: {
              input: path.resolve(__dirname, 'electron/preload.ts'),
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
