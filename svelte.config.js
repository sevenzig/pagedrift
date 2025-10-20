import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	compilerOptions: {
		runes: true
	},

	kit: {
		adapter: adapter({
			out: 'build',
			precompress: false,
			envPrefix: '',
			polyfill: false,
			bodySize: 1073741824  // 1GB in bytes (1024 * 1024 * 1024)
		}),
		csrf: {
			trustedOrigins: [
				'https://books.phelddagrif.farm',
				'http://localhost:3000',
				'http://localhost:5173',
				'http://localhost:7000'  // Local Docker testing
			]
		}
	}
};

export default config;
