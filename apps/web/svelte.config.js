import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://svelte.dev/docs/kit/integrations
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        // adapter-node for SSR deployment
        adapter: adapter({
            out: 'build',
            precompress: true,
            envPrefix: 'PUBLIC_'
        })
    },
    compilerOptions: {
        runes: true //룬 모드 강제 적용
    }
};

export default config;
