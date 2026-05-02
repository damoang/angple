import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { resolveSiteId } from '../../hooks/site-context.js';
import { getProviderConfig } from '../../server/config-store.js';
import { createOrder } from '../../server/orders-store.js';
import { getProvider } from '../../providers/registry.js';
import type { Currency, PaymentProviderId } from '../../types/index.js';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = event.locals.user;
    if (!user) throw error(401, 'authentication required');

    const body = (await event.request.json()) as {
        provider: PaymentProviderId;
        amount: number;
        currency?: Currency;
        description?: string;
        returnUrl: string;
        cancelUrl: string;
        metadata?: Record<string, unknown>;
    };

    if (!body.provider || !body.amount || !body.returnUrl || !body.cancelUrl) {
        throw error(400, 'missing required fields');
    }

    const siteId = resolveSiteId(event.url.host);
    const config = await getProviderConfig(siteId, body.provider);
    if (!config) throw error(400, `provider not configured: ${body.provider}`);

    const orderUid = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const order = await createOrder({
        siteId,
        userId: user.mb_no ?? user.id ?? 0,
        orderUid,
        provider: body.provider,
        amount: body.amount,
        currency: body.currency ?? 'KRW',
        description: body.description,
        metadata: body.metadata
    });

    const provider = getProvider(body.provider);
    const prep = await provider.prepare(config, {
        order: {
            orderUid: order.orderUid,
            amount: order.amount,
            currency: order.currency,
            description: order.description ?? null
        },
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl,
        customerKey: String(order.userId)
    });

    return json({
        orderUid: order.orderUid,
        provider: order.provider,
        sandbox: config.sandbox,
        sdkParams: prep.sdkParams ?? null,
        redirectUrl: prep.redirectUrl ?? null,
        pgOrderId: prep.pgOrderId
    });
}
