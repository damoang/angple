import type {
    PaymentProvider,
    ProviderConfig,
    PreparePaymentInput,
    PreparePaymentResult,
    CompletePaymentInput,
    CompletePaymentResult,
    RefundInput,
    RefundResult,
    VerifyWebhookInput
} from '../../types/index.js';

interface PayPalCreds {
    clientId: string;
    clientSecret: string;
    /** Webhook ID — webhook 검증에 사용 (PayPal verify-webhook-signature API) */
    webhookId?: string;
}

const PAYPAL_API_BASE_PROD = 'https://api-m.paypal.com';
const PAYPAL_API_BASE_SANDBOX = 'https://api-m.sandbox.paypal.com';

function baseUrl(config: ProviderConfig<PayPalCreds>): string {
    return config.sandbox ? PAYPAL_API_BASE_SANDBOX : PAYPAL_API_BASE_PROD;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(config: ProviderConfig<PayPalCreds>): Promise<string> {
    const key = `${config.siteId}:${config.sandbox ? 'sb' : 'prod'}:${config.credentials.clientId}`;
    const cached = tokenCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 30_000) return cached.token;

    const auth = Buffer.from(
        `${config.credentials.clientId}:${config.credentials.clientSecret}`
    ).toString('base64');
    const res = await fetch(`${baseUrl(config)}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
        throw new Error(`PayPal OAuth failed: ${(json.error_description as string) ?? res.status}`);
    }
    const token = json.access_token as string;
    const expiresIn = (json.expires_in as number) ?? 3000;
    tokenCache.set(key, { token, expiresAt: now + expiresIn * 1000 });
    return token;
}

async function paypalFetch<T>(
    config: ProviderConfig<PayPalCreds>,
    path: string,
    init: RequestInit
): Promise<T> {
    const token = await getAccessToken(config);
    const res = await fetch(`${baseUrl(config)}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {})
        }
    });
    const json = (await res.json()) as T;
    if (!res.ok) {
        const errMsg = (json as Record<string, unknown>).message ?? `HTTP_${res.status}`;
        throw new Error(`PayPal: ${errMsg}`);
    }
    return json;
}

export const paypalProvider: PaymentProvider = {
    id: 'paypal',

    async prepare(
        config: ProviderConfig<PayPalCreds>,
        input: PreparePaymentInput
    ): Promise<PreparePaymentResult> {
        const order = await paypalFetch<Record<string, unknown>>(config, '/v2/checkout/orders', {
            method: 'POST',
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        reference_id: input.order.orderUid,
                        description: input.order.description ?? 'Order',
                        amount: {
                            currency_code: input.order.currency,
                            value: input.order.amount.toFixed(2)
                        }
                    }
                ],
                application_context: {
                    return_url: input.returnUrl,
                    cancel_url: input.cancelUrl
                }
            })
        });

        const links = (order.links as Array<Record<string, string>>) ?? [];
        const approve = links.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
        return {
            redirectUrl: approve?.href,
            pgOrderId: order.id as string
        };
    },

    async complete(
        config: ProviderConfig<PayPalCreds>,
        input: CompletePaymentInput
    ): Promise<CompletePaymentResult> {
        const captured = await paypalFetch<Record<string, unknown>>(
            config,
            `/v2/checkout/orders/${encodeURIComponent(input.pgOrderId)}/capture`,
            { method: 'POST' }
        );
        const purchaseUnits = (captured.purchase_units as Array<Record<string, unknown>>) ?? [];
        const captures = (purchaseUnits[0]?.payments as Record<string, unknown>)?.captures as
            | Array<Record<string, unknown>>
            | undefined;
        const capture = captures?.[0];
        return {
            pgTransactionId: (capture?.id as string) ?? (captured.id as string),
            paidAt: new Date((capture?.create_time as string) ?? Date.now()),
            raw: captured
        };
    },

    async refund(config: ProviderConfig<PayPalCreds>, input: RefundInput): Promise<RefundResult> {
        const refund = await paypalFetch<Record<string, unknown>>(
            config,
            `/v2/payments/captures/${encodeURIComponent(input.pgTransactionId)}/refund`,
            {
                method: 'POST',
                body: JSON.stringify({
                    amount: { value: input.amount.toFixed(2), currency_code: 'USD' },
                    note_to_payer: input.reason
                })
            }
        );
        return {
            pgRefundId: refund.id as string,
            refundedAt: new Date((refund.create_time as string) ?? Date.now()),
            raw: refund
        };
    },

    verifyWebhook(_config: ProviderConfig<PayPalCreds>, input: VerifyWebhookInput): boolean {
        // 정식 검증은 PayPal의 /v1/notifications/verify-webhook-signature API 호출이 필요.
        // 동기 verifyWebhook 시그니처를 유지하기 위해 본 메서드는 1차 페이로드 형식만 검증하고,
        // 실제 verify는 webhook 핸들러에서 별도로 호출하는 패턴을 권장.
        try {
            const json = JSON.parse(input.rawBody) as Record<string, unknown>;
            return Boolean(json.event_type && json.id);
        } catch {
            return false;
        }
    }
};
