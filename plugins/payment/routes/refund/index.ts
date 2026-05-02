import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { resolveSiteId } from '../../hooks/site-context.js';
import { getProviderConfig } from '../../server/config-store.js';
import { getOrderByUid, updateOrderStatus, recordEvent } from '../../server/orders-store.js';
import { getProvider } from '../../providers/registry.js';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = event.locals.user;
    if (!user) throw error(401, 'authentication required');
    if ((user.level ?? 0) < 10) throw error(403, 'admin only');

    const body = (await event.request.json()) as {
        orderUid: string;
        amount?: number;
        reason?: string;
    };
    if (!body.orderUid) throw error(400, 'orderUid required');

    const order = await getOrderByUid(body.orderUid);
    if (!order) throw error(404, 'order not found');
    if (order.status !== 'paid') throw error(400, `cannot refund order in status: ${order.status}`);
    if (!order.pgTransactionId) throw error(400, 'order has no pgTransactionId');

    const siteId = resolveSiteId(event);
    const config = await getProviderConfig(siteId, order.provider);
    if (!config) throw error(400, 'provider not configured');

    const refundAmount = body.amount ?? order.amount;
    const provider = getProvider(order.provider);
    const result = await provider.refund(config, {
        pgTransactionId: order.pgTransactionId,
        amount: refundAmount,
        reason: body.reason
    });

    await updateOrderStatus(order.id, 'refunded', { refundedAt: result.refundedAt });
    await recordEvent({
        orderId: order.id,
        siteId,
        provider: order.provider,
        eventType: 'refund',
        payload: result.raw,
        signatureValid: null
    });

    return json({
        orderUid: order.orderUid,
        status: 'refunded',
        pgRefundId: result.pgRefundId,
        refundedAt: result.refundedAt.toISOString()
    });
}
