import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
        error(400, 'invalid building id');
    }
    return { buildingId: id };
};
