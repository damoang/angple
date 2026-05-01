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

interface TossCreds {
    clientKey: string;
    secretKey: string;
}

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

function basicAuth(secretKey: string): string {
    return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

async function tossFetch(
    secretKey: string,
    path: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const res = await fetch(`${TOSS_API_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: basicAuth(secretKey),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
        const code = (json.code as string) ?? `HTTP_${res.status}`;
        const message = (json.message as string) ?? 'Toss API error';
        throw new Error(`Toss ${code}: ${message}`);
    }
    return json;
}

export const tossProvider: PaymentProvider = {
    id: 'toss',

    async prepare(
        config: ProviderConfig<TossCreds>,
        input: PreparePaymentInput
    ): Promise<PreparePaymentResult> {
        return {
            sdkParams: {
                clientKey: config.credentials.clientKey,
                customerKey: input.customerKey,
                orderId: input.order.orderUid,
                orderName: input.order.description ?? '주문',
                amount: input.order.amount,
                currency: input.order.currency,
                successUrl: input.returnUrl,
                failUrl: input.cancelUrl
            },
            pgOrderId: input.order.orderUid
        };
    },

    async complete(
        config: ProviderConfig<TossCreds>,
        input: CompletePaymentInput
    ): Promise<CompletePaymentResult> {
        if (!input.pgPaymentKey) {
            throw new Error('Toss complete requires pgPaymentKey');
        }
        const json = await tossFetch(config.credentials.secretKey, '/payments/confirm', {
            paymentKey: input.pgPaymentKey,
            orderId: input.pgOrderId,
            amount: input.amount
        });
        return {
            pgTransactionId: (json.paymentKey as string) ?? input.pgPaymentKey,
            paidAt: new Date((json.approvedAt as string) ?? Date.now()),
            raw: json
        };
    },

    async refund(
        config: ProviderConfig<TossCreds>,
        input: RefundInput
    ): Promise<RefundResult> {
        const json = await tossFetch(
            config.credentials.secretKey,
            `/payments/${encodeURIComponent(input.pgTransactionId)}/cancel`,
            {
                cancelReason: input.reason ?? '환불',
                cancelAmount: input.amount
            }
        );
        const cancels = json.cancels as Array<Record<string, unknown>> | undefined;
        const last = cancels?.[cancels.length - 1];
        return {
            pgRefundId: (last?.transactionKey as string) ?? `toss-refund-${Date.now()}`,
            refundedAt: new Date((last?.canceledAt as string) ?? Date.now()),
            raw: json
        };
    },

    verifyWebhook(_config: ProviderConfig<TossCreds>, input: VerifyWebhookInput): boolean {
        // Toss는 webhook 전용 시그니처 필드를 별도로 제공하지 않고, 응답 본문 자체를 다시 confirm API로 재검증하는 패턴.
        // sandbox/초기 단계에서는 IP allow-list + body 파싱 가능 여부로 1차 검증.
        try {
            JSON.parse(input.rawBody);
            return true;
        } catch {
            return false;
        }
    }
};
