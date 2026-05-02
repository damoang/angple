export type PaymentProviderId = 'toss' | 'naver' | 'paypal';

export type Currency = 'KRW' | 'USD';

export type PaymentStatus = 'pending' | 'prepared' | 'paid' | 'cancelled' | 'refunded' | 'failed';

export interface PaymentOrder {
    id: number;
    siteId: number;
    userId: number;
    orderUid: string;
    provider: PaymentProviderId;
    pgOrderId?: string | null;
    pgTransactionId?: string | null;
    amount: number;
    currency: Currency;
    status: PaymentStatus;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    paidAt?: Date | null;
    refundedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** 사이트별 PG 키/설정 (DB의 payment_provider_configs 1행) */
export interface ProviderConfig<TCreds = Record<string, string>> {
    siteId: number;
    provider: PaymentProviderId;
    sandbox: boolean;
    active: boolean;
    credentials: TCreds;
    config?: Record<string, unknown>;
}

/** 결제 준비 입력 */
export interface PreparePaymentInput {
    order: Pick<PaymentOrder, 'orderUid' | 'amount' | 'currency' | 'description'>;
    /** 결제 완료 후 리다이렉트할 절대/상대 URL */
    returnUrl: string;
    /** 결제 실패/취소 시 리다이렉트 URL */
    cancelUrl: string;
    /** 사용자 식별 (PG 측 customerKey 등으로 활용) */
    customerKey: string;
}

/** 결제 준비 결과 — PG별로 다른 형태 (리다이렉트 URL 또는 SDK 파라미터) */
export interface PreparePaymentResult {
    /** redirect 방식 PG (페이팔 등): 사용자가 이동할 URL */
    redirectUrl?: string;
    /** widget/SDK 방식 PG (토스 등): 클라이언트 SDK 호출에 필요한 파라미터 */
    sdkParams?: Record<string, unknown>;
    /** PG 측 주문 식별자 (이후 complete/refund 시 사용) */
    pgOrderId: string;
}

export interface CompletePaymentInput {
    pgOrderId: string;
    /** PG가 콜백/리턴 시 전달하는 식별자 (예: Toss의 paymentKey) */
    pgPaymentKey?: string;
    amount: number;
}

export interface CompletePaymentResult {
    pgTransactionId: string;
    paidAt: Date;
    /** PG 응답 원본 (감사용) */
    raw: Record<string, unknown>;
}

export interface RefundInput {
    pgTransactionId: string;
    amount: number;
    reason?: string;
}

export interface RefundResult {
    pgRefundId: string;
    refundedAt: Date;
    raw: Record<string, unknown>;
}

export interface VerifyWebhookInput {
    rawBody: string;
    headers: Record<string, string>;
}

export interface PaymentProvider {
    readonly id: PaymentProviderId;
    prepare(config: ProviderConfig, input: PreparePaymentInput): Promise<PreparePaymentResult>;
    complete(config: ProviderConfig, input: CompletePaymentInput): Promise<CompletePaymentResult>;
    refund(config: ProviderConfig, input: RefundInput): Promise<RefundResult>;
    verifyWebhook(config: ProviderConfig, input: VerifyWebhookInput): boolean;
}
