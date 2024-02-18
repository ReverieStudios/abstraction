import preprocess from 'svelte-preprocess';
/** @type {import('@sveltejs/kit').Config} */
import adapter from '@sveltejs/adapter-auto';

const mode = process.env.NODE_ENV;
const dev = mode === 'development';

const config = {
	kit: {
		adapter: adapter(),
		vite: {
			server: {
				fs: {
					allow: ['localPackages/firebase-ssr/browser']
				}
			}
		}
	},
	preprocess: [
		preprocess({
			sourceMap: dev,
			postcss: true,
			typescript: true
		})
	]
};

export default config;
