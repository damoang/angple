import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { finishGoogle } from '$lib/server/wiki-auth';
export const GET: RequestHandler = async ({ cookies, url, locals }) => {
    if (!locals.wikiangSite) error(404);
    let target: string;
    try {
        target = await finishGoogle(cookies, url);
    } catch {
        // Never log tokens, authorization codes, client secrets, or provider response bodies.
        redirect(303, '/wiki-auth?failed=1');
    }
    redirect(303, target);
};
