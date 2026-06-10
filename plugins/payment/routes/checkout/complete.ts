import type { RequestEvent } from '@sveltejs/kit';
import { json, error } from '../../server/http.js';
import { resolveSiteId } from '../../hooks/site-context.js';
import { getProviderConfig } from '../../server/config-store.js';
import { getOrderByUid, updateOrderStatus, recordEvent } from '../../server/orders-store.js';
import { getProvider } from '../../providers/registry.js';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = event.locals.user;
    if (!user) throw error(401, 'authentication required');

    const body = (await event.request.json()) as {
        orderUid: string;
        pgOrderId: string;
        pgPaymentKey?: string;
        amount: number;
    };

    if (!body.orderUid || !body.pgOrderId || !body.amount) {
        throw error(400, 'missing required fields');
    }

    const order = await getOrderByUid(body.orderUid);
    if (!order) throw error(404, 'order not found');
    if (order.amount !== body.amount) {
        throw error(400, 'amount mismatch');
    }

    const siteId = resolveSiteId(event);
    const config = await getProviderConfig(siteId, order.provider);
    if (!config) throw error(400, `provider not configured: ${order.provider}`);

    const provider = getProvider(order.provider);
    const result = await provider.complete(config, {
        pgOrderId: body.pgOrderId,
        pgPaymentKey: body.pgPaymentKey,
        amount: body.amount
    });

    await updateOrderStatus(order.id, 'paid', {
        pgOrderId: body.pgOrderId,
        pgTransactionId: result.pgTransactionId,
        paidAt: result.paidAt
    });
    await recordEvent({
        orderId: order.id,
        siteId,
        provider: order.provider,
        eventType: 'checkout.complete',
        payload: result.raw,
        signatureValid: null
    });

    return json({
        orderUid: order.orderUid,
        status: 'paid',
        pgTransactionId: result.pgTransactionId,
        paidAt: result.paidAt.toISOString()
    });
}
