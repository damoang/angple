import { createHmac, timingSafeEqual } from 'node:crypto';
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

interface NaverCreds {
    clientId: string;
    clientSecret: string;
    chainId: string;
    /** webhook signature secret */
    webhookSecret?: string;
}

const NAVER_API_BASE_PROD = 'https://apis.naver.com/naverpay-partner/naverpay/payments/v2.2';
const NAVER_API_BASE_SANDBOX = 'https://dev.apis.naver.com/naverpay-partner/naverpay/payments/v2.2';

function naverHeaders(creds: NaverCreds): Record<string, string> {
    return {
        'X-Naver-Client-Id': creds.clientId,
        'X-Naver-Client-Secret': creds.clientSecret,
        'X-NaverPay-Chain-Id': creds.chainId,
        'X-NaverPay-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };
}

async function naverFetch(
    config: ProviderConfig<NaverCreds>,
    path: string,
    form: Record<string, string>
): Promise<Record<string, unknown>> {
    const base = config.sandbox ? NAVER_API_BASE_SANDBOX : NAVER_API_BASE_PROD;
    const body = new URLSearchParams(form).toString();
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: naverHeaders(config.credentials),
        body
    });
    const json = (await res.json()) as Record<string, unknown>;
    const code = (json.code as string) ?? '';
    if (!res.ok || code !== 'Success') {
        const message = (json.message as string) ?? 'Naver Pay API error';
        throw new Error(`NaverPay ${code || `HTTP_${res.status}`}: ${message}`);
    }
    return (json.body as Record<string, unknown>) ?? json;
}

export const naverProvider: PaymentProvider = {
    id: 'naver',

    async prepare(
        _config: ProviderConfig<NaverCreds>,
        input: PreparePaymentInput
    ): Promise<PreparePaymentResult> {
        // 네이버페이는 클라이언트 SDK(JS)에서 reserve → 서버에서 apply 흐름.
        // prepare 단계에서는 클라이언트가 SDK 호출에 사용할 파라미터를 그대로 반환.
        return {
            sdkParams: {
                merchantUserKey: input.customerKey,
                merchantPayKey: input.order.orderUid,
                productName: input.order.description ?? '상품',
                totalPayAmount: input.order.amount,
                taxScopeAmount: input.order.amount,
                taxExScopeAmount: 0,
                returnUrl: input.returnUrl
            },
            pgOrderId: input.order.orderUid
        };
    },

    async complete(
        config: ProviderConfig<NaverCreds>,
        input: CompletePaymentInput
    ): Promise<CompletePaymentResult> {
        if (!input.pgPaymentKey) {
            throw new Error('NaverPay complete requires pgPaymentKey (paymentId)');
        }
        const body = await naverFetch(config, '/apply/payment', {
            paymentId: input.pgPaymentKey
        });
        const detail = (body.detail as Record<string, unknown>) ?? body;
        return {
            pgTransactionId: (detail.paymentId as string) ?? input.pgPaymentKey,
            paidAt: new Date((detail.admissionYmdt as string) ?? Date.now()),
            raw: body
        };
    },

    async refund(
        config: ProviderConfig<NaverCreds>,
        input: RefundInput
    ): Promise<RefundResult> {
        const body = await naverFetch(config, '/cancel', {
            paymentId: input.pgTransactionId,
            cancelAmount: String(input.amount),
            cancelReason: input.reason ?? '환불',
            cancelRequester: '2'
        });
        return {
            pgRefundId: (body.cancelId as string) ?? `naver-refund-${Date.now()}`,
            refundedAt: new Date(),
            raw: body
        };
    },

    verifyWebhook(config: ProviderConfig<NaverCreds>, input: VerifyWebhookInput): boolean {
        const secret = config.credentials.webhookSecret;
        const signature = input.headers['x-naverpay-signature'] ?? input.headers['X-NaverPay-Signature'];
        if (!secret || !signature) return false;
        const expected = createHmac('sha256', secret).update(input.rawBody).digest('hex');
        const sig = signature.toLowerCase();
        if (sig.length !== expected.length) return false;
        try {
            return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } catch {
            return false;
        }
    }
};
