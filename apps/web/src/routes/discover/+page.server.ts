import type { PageServerLoad } from './$types';
import { loadDiscoverData } from '$lib/server/discover-loader';

export const load: PageServerLoad = async () => {
    const discoverData = await loadDiscoverData();

    return {
        discoverData
    };
};
