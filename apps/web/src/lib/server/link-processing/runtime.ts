import { getPluginById } from '$lib/server/plugins';

const PRIVATE_LINK_PROCESSING_PLUGIN_ID = 'affiliate-link-private';

export async function isLinkProcessingPluginEnabled(): Promise<boolean> {
    const plugin = await getPluginById(PRIVATE_LINK_PROCESSING_PLUGIN_ID);
    return Boolean(plugin?.isActive);
}
