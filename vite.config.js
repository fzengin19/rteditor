import { defineConfig } from 'vite';
import { resolve } from 'path';

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
