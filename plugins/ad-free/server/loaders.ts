/**
 * Ad-Free 페이지 데이터 로더.
 * 향후 사이트 settings (멀티사이트 #1287) 또는 plugin.json default 를 동적 로드하도록 확장.
 * 지금은 plugin.json default 와 동일한 정적 값.
 */

export type PlanId = 'monthly' | 'half_yearly';

export interface Plan {
    id: PlanId;
    label: string;
    price: number;
    period: string;
    /** 결제 주기 (개월 수). 정기결제 webhook 에서 다음 결제일 계산에 사용. */
    billingMonths: number;
    badge?: string;
    recommended?: boolean;
}

export interface Benefit {
    icon: string;
    title: string;
    desc: string;
}

export interface Faq {
    q: string;
    a: string;
}

export interface LandingData {
    productName: string;
    currency: 'KRW' | 'USD';
    plans: Plan[];
    benefits: Benefit[];
    trialDays: number;
    supportEmail: string;
    faqs: Faq[];
}

export interface LoadOptions {
    siteId?: string;
}

export interface ProviderOption {
    id: 'naverpay' | 'paypal';
    label: string;
    description?: string;
}

export interface CheckoutData {
    productName: string;
    currency: 'KRW' | 'USD';
    plans: Plan[];
    providers: ProviderOption[];
    initialPlan: PlanId;
    trialDays: number;
    supportEmail: string;
    /**
     * 가맹점 심사 통과 여부. false 이면 결제 버튼 클릭 시 안내 모달만 노출,
     * 실제 PG 호출은 일어나지 않는다. 가맹 통과 후 plugin.json settings 또는
     * 서버 환경변수로 true 전환 → 정상 결제 흐름 진입.
     */
    isMerchantApproved: boolean;
    /** 비회원 결제 정책 (옵션 B 자동 회원 생성) */
    guestPolicy: GuestPolicy;
}

export interface GuestPolicy {
    /** 비회원 결제 허용 여부 (사이트 settings) */
    enabled: boolean;
    /** 결제 완료 후 자동 회원 생성 (옵션 B). 환영 메일로 비번 재설정 링크 전송. */
    autoCreateMember: boolean;
    /** 약관 동의 필수 항목 */
    requiredAgreements: Array<{ id: string; label: string; required: boolean }>;
}

export async function loadCheckout(opts: {
    siteId?: string;
    initialPlan: PlanId;
}): Promise<CheckoutData> {
    const landing = await loadLanding({ siteId: opts.siteId });
    return {
        productName: landing.productName,
        currency: landing.currency,
        plans: landing.plans,
        providers: [
            { id: 'naverpay', label: '네이버페이', description: '국내 카드 · 계좌 정기결제' },
            { id: 'paypal', label: 'PayPal', description: '해외 결제 Subscription' }
        ],
        initialPlan: opts.initialPlan,
        trialDays: landing.trialDays,
        supportEmail: landing.supportEmail,
        isMerchantApproved: false,
        guestPolicy: {
            enabled: true,
            autoCreateMember: true,
            requiredAgreements: [
                { id: 'terms', label: '이용약관 동의', required: true },
                { id: 'privacy', label: '개인정보 수집·이용 동의', required: true },
                {
                    id: 'recurring',
                    label: '정기결제 자동 갱신 안내 동의',
                    required: true
                },
                {
                    id: 'auto_signup',
                    label: '결제 완료 시 자동 회원 가입 (이메일로 비밀번호 안내) 동의',
                    required: true
                }
            ]
        }
    };
}

export async function loadLanding(_opts: LoadOptions = {}): Promise<LandingData> {
    return {
        productName: '광고 제거 멤버십',
        currency: 'KRW',
        plans: [
            {
                id: 'monthly',
                label: '월간 정기결제',
                price: 4700,
                period: '월',
                billingMonths: 1
            },
            {
                id: 'half_yearly',
                label: '6개월 정기결제',
                price: 28200,
                period: '6개월',
                billingMonths: 6
            }
        ],
        benefits: [
            {
                icon: '🖥️',
                title: 'PC AdSense 광고 제거',
                desc: 'PC 에서 보는 구글 AdSense 광고가 사라집니다'
            },
            {
                icon: '📱',
                title: '모바일 광고는 유지',
                desc: '모바일 AdSense 는 정상 노출 — 모바일 사용자 경험은 그대로'
            },
            {
                icon: '🎯',
                title: '다모앙 자체 배너 유지',
                desc: '다모앙 자체 광고앙(이미지·텍스트) 배너는 멤버십과 무관하게 노출'
            },
            {
                icon: '🎁',
                title: '7일 무료 체험 · 언제든 해지',
                desc: '결제 전 체험 + 약정 없이 자유 해지'
            }
        ],
        trialDays: 7,
        supportEmail: 'help@example.com',
        faqs: [
            {
                q: '모바일에서도 광고가 사라지나요?',
                a: '아니요. ad-free 멤버십은 PC 의 구글 AdSense 광고만 제거합니다. 모바일 AdSense + 다모앙 자체 광고앙(이미지·텍스트) 배너는 멤버십과 무관하게 정상 노출됩니다. 모바일 사용자 경험 + 다모앙 운영 광고는 그대로 유지됩니다.'
            },
            {
                q: '다모앙 자체 광고도 사라지나요?',
                a: '아니요. 다모앙의 자체 광고앙(사이드바/메인 배너 등) 은 멤버십 활성 여부와 무관하게 항상 노출됩니다. 멤버십이 제거하는 것은 외부 광고 네트워크(Google AdSense) 의 PC 광고 슬롯에 한정됩니다.'
            },
            {
                q: '결제 수단은 어떤 것을 지원하나요?',
                a: '네이버페이 정기결제와 PayPal Subscription 을 지원합니다.'
            },
            {
                q: '7일 무료 체험 후 자동으로 결제되나요?',
                a: '체험 기간 종료 전 해지하시면 결제되지 않습니다. 체험 종료 시 선택하신 요금제로 자동 결제됩니다.'
            },
            {
                q: '환불은 어떻게 받을 수 있나요?',
                a: '환불 정책 페이지에 자세한 절차가 안내되어 있습니다. 영업일 기준 3~5일 이내 처리됩니다.'
            },
            {
                q: '구독 후 광고가 즉시 사라지나요?',
                a: '결제 완료 직후 로그인 상태에서 광고가 사라집니다. 다른 기기는 재로그인 시 반영됩니다.'
            },
            {
                q: '6개월 요금제는 어떤 점이 다른가요?',
                a: '6개월 요금제는 6개월치 정가를 한 번에 결제합니다 (월 ×6, 별도 할인 없음). 결제 주기를 줄여 결제 빈도를 낮출 수 있습니다.'
            }
        ]
    };
}
