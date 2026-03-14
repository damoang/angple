import type { RequestHandler } from './$types';
import { ADS_TXT_CONTENT } from '$lib/server/ads-txt';

export const GET: RequestHandler = async () => {
    return new Response(ADS_TXT_CONTENT, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};
