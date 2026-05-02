/**
 * GET /api/plugins/brickang/brick-types/:slug
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getBrickTypeBySlug } from '../../server/brick-types.js';

export async function GET(event: RequestEvent): Promise<Response> {
    const slug = event.params.slug;
    if (!slug) throw error(400, 'slug required');

    const t = await getBrickTypeBySlug(slug);
    if (!t) throw error(404, 'brick_type not found');

    return json({
        id: t.id,
        slug: t.slug,
        name: t.name,
        price_krw: t.priceKrw,
        price_usd: t.priceUsd,
        color_hex: t.colorHex,
        texture_url: t.textureUrl,
        size_multiplier: t.sizeMultiplier,
        glow_effect: t.glowEffect,
        is_anonymous: t.isAnonymous,
        allow_message: t.allowMessage,
        is_active: t.isActive,
        sort_order: t.sortOrder
    });
}
