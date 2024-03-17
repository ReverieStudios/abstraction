import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
        plugins: [sveltekit()],
        server: {
            fs: {
                allow: ['localPackages/firebase-ssr/browser']
            },
            proxy: {
                '/__/auth': {
                  target: 'https://reverie-demo.firebaseapp.com',
                  changeOrigin: true
                }
              },
        },
});