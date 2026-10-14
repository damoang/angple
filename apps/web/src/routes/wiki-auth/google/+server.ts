import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { beginGoogle, digest } from '$lib/server/wiki-auth';
import { getRedis } from '$lib/server/redis';
export const GET: RequestHandler = async ({ cookies, url, locals, getClientAddress }) => {
    if (!locals.wikiangSite) error(404);
    const key =
        'wikiang:auth:rate:' + digest(getClientAddress()) + ':' + Math.floor(Date.now() / 60000);
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, 120);
    if (count > 10) error(429, '로그인 요청이 많습니다. 잠시 후 다시 시도해주세요.');
    redirect(303, await beginGoogle(cookies, url));
};
