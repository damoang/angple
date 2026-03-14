import type { PageServerLoad } from './$types';
import { loadExploreData } from '$lib/server/explore-loader';

export const load: PageServerLoad = async () => {
    const exploreData = await loadExploreData();

    return {
        exploreData
    };
};
