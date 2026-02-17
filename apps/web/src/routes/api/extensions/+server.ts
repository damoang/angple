/**
 * Extension API - 전체 Extension 목록 조회
 *
 * GET /api/extensions
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scanExtensions } from '$lib/server/extensions/scanner';

export const GET: RequestHandler = async () => {
    try {
        const extensionsMap = scanExtensions();
        const extensions = Array.from(extensionsMap.values());

        return json({
            success: true,
            data: extensions,
            count: extensions.length
        });
    } catch (error) {
        console.error('[API /extensions] Extension 목록 조회 실패:', error);

        return json(
            {
                success: false,
                error: 'Failed to fetch extensions',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
};
