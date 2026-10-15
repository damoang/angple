import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readPool } from '$lib/server/db.js';

export const GET: RequestHandler = async ({ params }) => {
    const { id } = params;

    try {
        const [rows] = await readPool.query(
            `SELECT id, name, slug, description, short_desc, product_type,
                    price, original_price, currency, stock_quantity, stock_status,
                    featured_image, gallery_images, meta_data,
                    sales_count, view_count, rating_avg, rating_count, published_at
             FROM commerce_products
             WHERE id = ? AND status = 'published' AND deleted_at IS NULL`,
            [id]
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mysql2 쿼리 결과 행이라 스키마 타입이 없다
        const products = rows as any[];
        if (products.length === 0) {
            return json({ success: false, error: '상품을 찾을 수 없습니다' }, { status: 404 });
        }

        return json({ success: true, data: products[0] });
    } catch (err) {
        console.error('[commerce] product detail error:', err);
        return json({ success: false, error: 'Internal error' }, { status: 500 });
    }
};
