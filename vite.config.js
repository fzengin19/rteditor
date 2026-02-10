import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));


export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'RTEditor',
      fileName: (format) => `rteditor.${format}.js`,
      formats: ['es', 'umd'],
    },
    copyPublicDir: false,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
