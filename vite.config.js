import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: 'index.html',
        },
    },
    css: {
        postcss: {
            plugins: [tailwindcss, autoprefixer],
        },
    },
    optimizeDeps: {
        exclude: ['@vitejs/plugin-wasm'], // Ensure no bundling issues with WASM
    },
});

