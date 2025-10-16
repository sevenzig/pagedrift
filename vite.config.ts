import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
        plugins: [sveltekit(), tailwindcss()],
        server: {
                host: '0.0.0.0',
                port: 5000,
                fs: {
                        strict: true,
                        allow: ['.']
                }
        },
        preview: {
                host: '0.0.0.0',
                port: 5000
        }
});
