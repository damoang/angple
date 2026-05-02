/**
 * GET /api/plugins/brickang/brick-types
 * 활성 5종 등급 목록.
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import { listBrickTypes } from '../../server/brick-types.js';

export async function GET(_event: RequestEvent): Promise<Response> {
    const types = await listBrickTypes();
    return json({
        brick_types: types.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            price_krw: t.priceKrw,
            price_usd: t.priceUsd,
            color_hex: t.colorHex,
            size_multiplier: t.sizeMultiplier,
            glow_effect: t.glowEffect,
            is_anonymous: t.isAnonymous,
            allow_message: t.allowMessage,
            sort_order: t.sortOrder
        }))
    });
}
