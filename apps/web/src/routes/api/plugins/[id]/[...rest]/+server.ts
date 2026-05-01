import type { RequestHandler } from './$types';
import { dispatchPluginRoute } from '$lib/server/plugins/route-dispatcher';

function makeHandler(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): RequestHandler {
    return async (event) => {
        const { id, rest } = event.params;
        return dispatchPluginRoute({
            pluginId: id ?? '',
            rest: `/${rest ?? ''}`,
            method,
            event
        });
    };
}

export const GET: RequestHandler = makeHandler('GET');
export const POST: RequestHandler = makeHandler('POST');
export const PUT: RequestHandler = makeHandler('PUT');
export const PATCH: RequestHandler = makeHandler('PATCH');
export const DELETE: RequestHandler = makeHandler('DELETE');
