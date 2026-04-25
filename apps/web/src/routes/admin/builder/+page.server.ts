import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
    BUILDER_SCHEMA_VERSION,
    isBuilderContent,
    type BuilderContent
} from '$lib/builder/types.js';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

/**
 * Admin Builder PoC route — issue #1288 Sprint Contract Day 4.
 * Super-admin (level >= 10) only. feature flag USE_BUILDER=false 시 404.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
    if (env.USE_BUILDER === 'false') {
        throw redirect(302, '/admin');
    }

    if (!locals.user) {
        throw redirect(302, '/login?redirect=/admin/builder');
    }

    if ((locals.user.level ?? 0) < 10) {
        throw redirect(302, '/?error=forbidden');
    }

    // PoC: site_id default 1 (sites 테이블 prod 미존재 — Phase 2 에서 실제 site 선택 UI).
    const siteId = Number(url.searchParams.get('site_id') ?? '1');
    const contentKey = url.searchParams.get('key') ?? 'home';

    let initialContent: BuilderContent = {
        schema_version: BUILDER_SCHEMA_VERSION,
        blocks: []
    };

    if (locals.accessToken) {
        try {
            const response = await fetch(
                `${BACKEND_URL}/api/v1/admin/sites/${siteId}/content/${encodeURIComponent(
                    contentKey
                )}`,
                {
                    headers: {
                        Authorization: `Bearer ${locals.accessToken}`
                    }
                }
            );

            if (response.ok) {
                const result = await response.json();
                const blocksRaw = result?.data?.content?.blocks;
                if (typeof blocksRaw === 'string') {
                    try {
                        const parsed = JSON.parse(blocksRaw);
                        if (isBuilderContent(parsed)) {
                            initialContent = parsed;
                        }
                    } catch (err) {
                        console.error('[admin/builder] failed to parse blocks:', err);
                    }
                }
            } else if (response.status !== 404) {
                console.error('[admin/builder] backend error:', response.status);
            }
        } catch (err) {
            console.error('[admin/builder] backend fetch failed:', err);
        }
    }

    return {
        siteId,
        contentKey,
        initialContent,
        user: locals.user
    };
};
