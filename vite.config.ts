import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        copyPublicDir: false,
        lib: {
            entry: resolve(__dirname, 'index.ts'),
            name: 'TiptapLinter',
            fileName: (format) => `index.${format === 'es' ? 'js' : 'umd.cjs'}`,
        },
        rollupOptions: {
            external: ['vue', '@tiptap/core', '@tiptap/pm', /^@tiptap\/pm\/.*/],
            output: {
                globals: (id) => {
                    if (id === 'vue') return 'Vue';
                    if (id === '@tiptap/core') return 'TiptapCore';
                    if (id.startsWith('@tiptap/pm'))
                        return id.replace('@tiptap/pm/', 'TiptapPm.');
                    return id;
                },
            },
        },
    },
    // Dev server config for demo
    root: resolve(__dirname, 'src/demo'),
    server: {
        host: '0.0.0.0',
        port: 5173,
    },
});
