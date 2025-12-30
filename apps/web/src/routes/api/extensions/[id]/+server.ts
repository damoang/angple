/**
 * Extension API - 특정 Extension 조회
 *
 * GET /api/extensions/:id
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getExtensionManifest } from '$lib/server/extensions/scanner';

export const GET: RequestHandler = async ({ params }) => {
    const { id } = params;

    try {
        const extension = getExtensionManifest(id);

        if (!extension) {
            return json(
                {
                    success: false,
                    error: 'Extension not found',
                    message: `Extension with ID "${id}" does not exist`
                },
                { status: 404 }
            );
        }

        console.log(`✅ [API /extensions/${id}] Extension 반환:`, extension.name);

        return json({
            success: true,
            data: extension
        });
    } catch (error) {
        console.error(`❌ [API /extensions/${id}] Extension 조회 실패:`, error);

        return json(
            {
                success: false,
                error: 'Failed to fetch extension',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
};
