import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    const { getActivePlugins } = await import('$lib/server/plugins/index.js');
    const plugins = await getActivePlugins();

    const activePlugins = plugins.map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        hooks: p.manifest.hooks || [],
        components: p.manifest.components || [],
        settings: p.currentSettings || null
    }));

    return json(
        { activePlugins },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800, max-age=60'
            }
        }
    );
};
