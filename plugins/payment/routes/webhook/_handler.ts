import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { resolveSiteId } from '../../hooks/site-context.js';
import { getProviderConfig } from '../../server/config-store.js';
import { recordEvent } from '../../server/orders-store.js';
import { getProvider } from '../../providers/registry.js';
import type { PaymentProviderId } from '../../types/index.js';

export async function handleWebhook(
    providerId: PaymentProviderId,
    event: RequestEvent
): Promise<Response> {
    const rawBody = await event.request.text();
    const headers: Record<string, string> = {};
    event.request.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
    });

    const siteId = resolveSiteId(event);
    const config = await getProviderConfig(siteId, providerId);

    let valid: boolean | null = null;
    if (config) {
        valid = getProvider(providerId).verifyWebhook(config, { rawBody, headers });
    }

    let payload: Record<string, unknown> = {};
    try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
        payload = { _rawBody: rawBody.slice(0, 500) };
    }

    await recordEvent({
        orderId: null,
        siteId,
        provider: providerId,
        eventType: (payload.event_type as string) ?? (payload.type as string) ?? 'unknown',
        payload,
        signatureValid: valid
    });

    if (!config) return json({ ok: false, reason: 'provider not configured' }, { status: 200 });
    if (!valid) return json({ ok: false, reason: 'invalid signature' }, { status: 200 });

    return json({ ok: true });
}
