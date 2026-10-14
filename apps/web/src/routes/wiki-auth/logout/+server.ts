import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/wiki-auth';
export const POST: RequestHandler = async ({ cookies, url, request, locals }) => {
    if (!locals.wikiangSite) error(404);
    if (request.headers.get('origin') !== url.origin) error(403, '요청 출처를 확인할 수 없습니다.');
    await destroySession(cookies, url);
    redirect(303, '/대문');
};
