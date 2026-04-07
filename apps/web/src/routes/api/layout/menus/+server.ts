import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

import { loadMenus } from '$lib/server/menu-loader';

export const GET: RequestHandler = async () => {
    const menus = await loadMenus();

    return json(
        { menus },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=300'
            }
        }
    );
};
