import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readPool } from '$lib/server/db.js';

export const GET: RequestHandler = async ({ url }) => {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    try {
        const [countRows] = await readPool.query(
            `SELECT COUNT(*) as total FROM commerce_products WHERE status = 'published' AND deleted_at IS NULL`
        );
        const total = (countRows as any)[0].total;

        const [rows] = await readPool.query(
            `SELECT id, name, slug, short_desc, product_type, price, original_price,
                    stock_quantity, stock_status, featured_image, gallery_images,
                    sales_count, view_count, rating_avg, rating_count, published_at
             FROM commerce_products
             WHERE status = 'published' AND deleted_at IS NULL
             ORDER BY published_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return json({
            success: true,
            data: { items: rows, total, page, limit }
        });
    } catch (err) {
        console.error('[commerce] products list error:', err);
        return json({ success: false, data: { items: [], total: 0 } }, { status: 500 });
    }
};
