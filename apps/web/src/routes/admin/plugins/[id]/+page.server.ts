import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPluginById } from '$lib/server/plugins';

export const load: PageServerLoad = async ({ params }) => {
    const plugin = await getPluginById(params.id);
    if (!plugin) throw error(404, `Plugin not found: ${params.id}`);
    if (!plugin.isActive) throw error(404, `Plugin not active: ${params.id}`);

    const adminMenu = plugin.manifest.ui?.admin?.menu;
    if (!adminMenu?.component) {
        throw error(404, `Plugin '${params.id}' has no admin menu`);
    }

    return {
        pluginId: plugin.manifest.id,
        title: adminMenu.title,
        componentPath: adminMenu.component
    };
};
