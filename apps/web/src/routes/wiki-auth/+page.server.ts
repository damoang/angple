import type { PageServerLoad } from './$types';
import { authConfigured, safeReturnPath } from '$lib/server/wiki-auth';
export const load: PageServerLoad = ({ locals, url }) => ({
    configured: authConfigured(),
    wikiUser: locals.wikiUser ?? null,
    failed: url.searchParams.has('failed'),
    returnTo: safeReturnPath(url.searchParams.get('returnTo'))
});
