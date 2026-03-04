<script lang="ts">
    import * as Accordion from '$lib/components/ui/accordion/index.js';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import Eye from '@lucide/svelte/icons/eye';
    import Users from '@lucide/svelte/icons/users';
    import FileText from '@lucide/svelte/icons/file-text';
    import Smartphone from '@lucide/svelte/icons/smartphone';
    import CircleHelp from '@lucide/svelte/icons/circle-help';
    import Info from '@lucide/svelte/icons/info';
    import Gift from '@lucide/svelte/icons/gift';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Mail from '@lucide/svelte/icons/mail';
    import ArrowRight from '@lucide/svelte/icons/arrow-right';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    type PricingPlan = {
        title: string;
        spec: string;
        price: string;
        unit: string;
        cpm?: string;
        cpmLink?: { text: string; href: string };
        featured?: boolean;
        features: string[];
    };

    const plans: PricingPlan[] = [
        {
            title: '축하메시지',
            spec: '770 x 90px',
            price: '5',
            unit: '만원/24시간',
            featured: true,
            cpmLink: { text: '개인 신청', href: 'https://forms.gle/Yj3D28THBxVNMWn2A' },
            features: [
                '축하 / 기념일 / 프로포즈 등',
                'PC/모바일 첫 페이지 노출',
                '개인 신청(현금영수증)'
            ]
        },
        {
            title: '직접홍보게시판',
            spec: '게시글 형태',
            price: '9',
            unit: '만원/월',
            cpmLink: { text: '바로가기', href: '/promotion' },
            features: ['모든 게시판 2줄 랜덤 노출', '하루 1회 홍보글 작성']
        },
        {
            title: '미니배너',
            spec: '125 x 90px',
            price: '30',
            unit: '만원/월',
            cpm: 'CPM 약 37원 · 월 800만 노출',
            features: ['사이드바 고정 노출', '모바일 햄버거 메뉴에 표시']
        },
        {
            title: '네모배너',
            spec: '200 x 200px',
            price: '70',
            unit: '만원/월',
            cpm: 'CPM 약 35원 · 월 2,000만 노출',
            features: ['PC 사이드 노출', '모바일 하단 노출']
        },
        {
            title: '스탠다드 긴배너',
            spec: '770 x 90px',
            price: '100',
            unit: '만원/월',
            cpm: 'CPM 약 33원 · 월 3,000만 노출',
            features: ['전체 페이지 노출', '애니메이션 이미지 사용']
        },
        {
            title: '프리미엄 긴배너',
            spec: '770 x 90px',
            price: '150',
            unit: '만원/월',
            cpm: 'CPM 약 30원 · 월 5,000만 노출',
            features: ['PC/모바일 첫 페이지 노출', '전체 페이지 노출', '애니메이션 이미지 사용']
        }
    ];

    const stats = [
        {
            icon: Eye,
            number: '5,000만',
            label: '월 최대 배너 노출',
            sub: '과거 최대 실적 최대 1.4억 노출'
        },
        { icon: Users, number: '939만', label: '연간 활성 사용자' },
        { icon: FileText, number: '6.2억', label: '연간 페이지뷰' },
        { icon: Smartphone, number: '61%', label: '모바일 비율' }
    ];

    type FaqItem = { question: string; answer: string; html?: boolean };

    const faqs: FaqItem[] = [
        {
            question: '광고 계약 절차는 어떻게 되나요?',
            answer: '1. 이메일 문의 또는 광고 신청하기\n2. 광고비 입금\n3. 계약서 작성'
        },
        {
            question: '디자인 지원이 가능한가요?',
            answer: '불가능합니다.'
        },
        {
            question: '금지되는 광고 내용이 있나요?',
            answer: '불법·사행성·성인물 등 부적합 콘텐츠, 과도한 애니메이션이나 색상으로 사용자 불편을 주는 소재, 클릭 유도형 "다크 패턴" (예: 가짜 닫기 버튼 등), 일반 게시판에 홍보글 작성 (직접홍보게시판 전용)'
        },
        {
            question: '환불 정책은 어떻게 되나요?',
            answer: '계약 기간 중 광고주 사유로 인한 중도 해지 시, 잔여 기간에 대한 환불은 (총 계약금액 - 이미 집행된 기간의 일할 계산 금액)에서 위약금 10%를 제외한 금액을 환불해드립니다. 단, 다모앙 사유로 인한 계약 불이행 시 전액 환불됩니다.'
        },
        {
            question: '노출 통계를 확인할 수 있나요?',
            answer: '네, 확인 할 수 있습니다.'
        },
        {
            question: '노출 수는 보장되나요?',
            answer: '전체 배너 슬롯 노출은 보장되나, 광고주 수에 따라 개별 노출은 변동됩니다. 실시간 대시보드로 투명하게 확인 가능합니다.',
            html: true
        }
    ];

    const comparison = [
        {
            label: 'CPM (배너광고)',
            community: '80~150원',
            portal: '500~2,000원',
            damoang: '30~37원'
        },
        {
            label: '월 노출량',
            community: '수백만~수천만',
            portal: '보장 없음',
            damoang: '500만~5,000만'
        },
        { label: '최소 금액', community: '50만원~', portal: '100만원~', damoang: '9만원~' },
        { label: '타겟팅', community: '제한적', portal: '상세 가능', damoang: '커뮤니티 특화' }
    ];
</script>

<svelte:head>
    <title>{data.title}</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-10">
    <!-- 가격표 Section -->
    <section class="mb-12">
        <h2 class="section-title">광고 상품 및 가격</h2>

        <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {#each plans as plan}
                <div
                    class="bg-card border-border hover:border-primary group relative flex h-full flex-col rounded-xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md {plan.featured
                        ? 'border-primary shadow-md'
                        : ''}"
                >
                    <!-- Header -->
                    <div class="border-border border-b px-5 pb-4 pt-6 text-center">
                        <h3 class="text-primary text-xl font-bold">{plan.title}</h3>
                        <p class="text-muted-foreground mt-1 text-sm">{plan.spec}</p>
                        <div class="text-foreground mt-3">
                            <span class="text-4xl font-bold">{plan.price}</span>
                            <span class="text-muted-foreground text-base">{plan.unit}</span>
                        </div>
                        {#if plan.cpm}
                            <p class="text-primary/80 mt-1 text-xs">{plan.cpm}</p>
                        {/if}
                        {#if plan.cpmLink}
                            <a
                                href={plan.cpmLink.href}
                                class="text-primary mt-1 inline-block text-xs font-medium hover:underline"
                                target={plan.cpmLink.href.startsWith('http') ? '_blank' : undefined}
                                rel={plan.cpmLink.href.startsWith('http')
                                    ? 'noopener noreferrer'
                                    : undefined}
                            >
                                {plan.cpmLink.text}
                            </a>
                        {/if}
                    </div>

                    <!-- Features -->
                    <ul class="flex-1 space-y-3 px-5 py-4">
                        {#each plan.features as feature, i}
                            <li class="flex items-start gap-2.5">
                                <CircleCheck class="text-primary mt-0.5 h-4 w-4 shrink-0" />
                                <span
                                    class="text-muted-foreground text-sm {i === 0
                                        ? 'font-semibold'
                                        : ''}">{feature}</span
                                >
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>

        <div class="bg-primary/10 text-primary mt-6 rounded-lg p-3 text-center text-sm font-medium">
            <Info class="mr-1 inline h-4 w-4" />
            축하메시지를 제외한 나머지 상품은 부가세 별도입니다.
        </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-muted/50 mb-12 rounded-xl p-8 sm:p-10">
        <div class="mb-8 text-center">
            <h2 class="text-foreground text-2xl font-bold">지금 바로 시작하세요</h2>
            <p class="text-muted-foreground mt-2">
                월 최대 5,000만 노출, 99,000원부터 시작 가능합니다.
            </p>
        </div>

        <div class="mx-auto grid max-w-xl grid-cols-1 gap-6 sm:grid-cols-2">
            <a
                href="https://forms.gle/Yj3D28THBxVNMWn2A"
                target="_blank"
                rel="noopener noreferrer"
                class="bg-card border-border hover:border-primary group rounded-xl border p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
                <div
                    class="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                >
                    <Gift class="text-primary h-7 w-7" />
                </div>
                <h3 class="text-foreground text-lg font-semibold">축하메시지</h3>
                <p class="text-muted-foreground mt-1 text-sm">특별한 날을 함께 축하해요</p>
                <span
                    class="bg-primary mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
                    >신청하기</span
                >
            </a>

            <a
                href="https://forms.gle/L8Qqb1UG18oiEuWv6"
                target="_blank"
                rel="noopener noreferrer"
                class="bg-card border-border hover:border-primary group rounded-xl border p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
                <div
                    class="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                >
                    <Megaphone class="text-primary h-7 w-7" />
                </div>
                <h3 class="text-foreground text-lg font-semibold">광고 신청</h3>
                <p class="text-muted-foreground mt-1 text-sm">배너 광고로 브랜드를 알리세요</p>
                <span
                    class="bg-primary mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
                    >신청하기</span
                >
            </a>
        </div>

        <p class="text-muted-foreground mt-6 text-center text-sm">
            <Mail class="mr-1 inline h-4 w-4" />
            이메일 문의:
            <a href="mailto:contact@damoang.net" class="text-primary hover:underline"
                >contact@damoang.net</a
            >
        </p>
    </section>

    <!-- 트래픽 데이터 -->
    <section class="mb-12">
        <h2 class="section-title">다모앙 트래픽 데이터</h2>
        <p class="text-muted-foreground mb-6 text-center text-sm">
            Google Analytics 기준 실제 데이터입니다 (2025년 1월~12월)
        </p>

        <div class="bg-muted/50 rounded-xl p-6 sm:p-8">
            <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
                {#each stats as stat}
                    <div
                        class="bg-card border-border rounded-xl border p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                        <stat.icon class="text-primary mx-auto mb-3 h-8 w-8 opacity-80" />
                        <span class="text-foreground block text-2xl font-bold sm:text-3xl"
                            >{stat.number}</span
                        >
                        <p class="text-muted-foreground mt-1 text-xs sm:text-sm">{stat.label}</p>
                        {#if stat.sub}
                            <p class="text-muted-foreground/60 mt-0.5 text-[0.65rem]">{stat.sub}</p>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="bg-card/80 mt-4 rounded-lg p-3 text-center text-sm">
                <Info class="text-muted-foreground mr-1 inline h-4 w-4" />
                <span class="text-muted-foreground"
                    >평일 평균 <strong class="text-foreground">614만 노출</strong> / 주말 평균
                    <strong class="text-foreground">87만 노출</strong> · 광고 효율은 운영 상황에 따라
                    변동될 수 있습니다.</span
                >
            </div>
        </div>
    </section>

    <!-- 실제 노출 예시 -->
    <section class="mb-12">
        <h2 class="section-title">실제 노출 예시</h2>
        <p class="text-muted-foreground mb-6 text-center text-sm">
            아래는 실제로 노출되는 광고 샘플입니다. 클릭하면 광고주 페이지로 이동합니다.
        </p>

        <div class="space-y-4">
            <!-- 긴배너 -->
            <div class="bg-card border-border rounded-xl border p-5 shadow-sm">
                <h3
                    class="text-foreground border-primary mb-3 inline-block border-b-2 pb-1 font-semibold"
                >
                    긴배너
                </h3>
                <div class="bg-muted/50 flex items-center justify-center rounded-lg p-4">
                    <span class="text-muted-foreground text-sm">770 x 90px 배너 영역</span>
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-5">
                <!-- 왼쪽: 네모배너 + 미니배너 -->
                <div class="space-y-4 md:col-span-2">
                    <div class="bg-card border-border rounded-xl border p-5 shadow-sm">
                        <h3
                            class="text-foreground border-primary mb-3 inline-block border-b-2 pb-1 font-semibold"
                        >
                            네모배너
                        </h3>
                        <div class="bg-muted/50 flex items-center justify-center rounded-lg p-4">
                            <span class="text-muted-foreground text-sm">200 x 200px 배너 영역</span>
                        </div>
                    </div>

                    <div class="bg-card border-border rounded-xl border p-5 shadow-sm">
                        <h3
                            class="text-foreground border-primary mb-3 inline-block border-b-2 pb-1 font-semibold"
                        >
                            미니배너
                        </h3>
                        <div class="bg-muted/50 flex items-center justify-center rounded-lg p-4">
                            <span class="text-muted-foreground text-sm">125 x 90px 배너 영역</span>
                        </div>
                    </div>
                </div>

                <!-- 오른쪽: 직접홍보게시판 -->
                <div class="md:col-span-3">
                    <div class="bg-card border-border h-full rounded-xl border p-5 shadow-sm">
                        <h3
                            class="text-foreground border-primary mb-3 inline-block border-b-2 pb-1 font-semibold"
                        >
                            직접홍보게시판
                        </h3>
                        <div class="bg-muted/50 overflow-hidden rounded-lg">
                            <img
                                src="https://s3.damoang.net/data/editor/2512/c5443e4.jpg"
                                alt="직접홍보게시판 샘플"
                                class="h-auto w-full"
                                loading="lazy"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 비교 테이블 -->
    <section class="mb-12">
        <h2 class="section-title">왜 다모앙 광고인가요?</h2>

        <div class="overflow-x-auto">
            <table class="border-border w-full overflow-hidden rounded-xl border text-sm">
                <thead>
                    <tr class="bg-primary text-primary-foreground">
                        <th class="px-4 py-3 text-left font-semibold">구분</th>
                        <th class="px-4 py-3 text-left font-semibold">일반 커뮤니티</th>
                        <th class="px-4 py-3 text-left font-semibold">포털 디스플레이</th>
                        <th class="bg-primary/90 px-4 py-3 text-left font-semibold">다모앙</th>
                    </tr>
                </thead>
                <tbody>
                    {#each comparison as row}
                        <tr class="border-border border-b last:border-b-0">
                            <td class="text-foreground px-4 py-3 font-semibold">{row.label}</td>
                            <td class="text-muted-foreground px-4 py-3">{row.community}</td>
                            <td class="text-muted-foreground px-4 py-3">{row.portal}</td>
                            <td class="bg-primary/5 text-primary px-4 py-3 font-bold"
                                >{row.damoang}</td
                            >
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <p class="text-muted-foreground mt-4 text-center text-sm">
            <ArrowRight class="mr-1 inline h-4 w-4" />
            다모앙은 <strong class="text-foreground">업계 평균 대비 1/3~1/5 수준</strong>의 CPM으로
            대량 노출이 가능합니다.
        </p>
    </section>

    <!-- FAQ -->
    <section class="mb-12">
        <h2 class="section-title">자주 묻는 질문</h2>

        <Accordion.Root type="single" class="mt-6 space-y-2">
            {#each faqs as faq, i}
                <Accordion.Item value="faq-{i}" class="bg-card border-border rounded-lg border">
                    <Accordion.Trigger
                        class="hover:bg-muted/50 [&[data-state=open]]:bg-primary/5 [&[data-state=open]]:text-primary flex w-full items-center gap-2 rounded-lg px-5 py-4 text-left font-medium transition-colors"
                    >
                        <CircleHelp class="h-4 w-4 shrink-0" />
                        {faq.question}
                    </Accordion.Trigger>
                    <Accordion.Content
                        class="text-muted-foreground px-5 pb-4 text-sm leading-relaxed"
                    >
                        {#if faq.question === '광고 계약 절차는 어떻게 되나요?'}
                            <ol class="list-decimal space-y-1 pl-5">
                                <li>이메일 문의 또는 광고 신청하기</li>
                                <li>광고비 입금</li>
                                <li>계약서 작성</li>
                            </ol>
                        {:else if faq.question === '금지되는 광고 내용이 있나요?'}
                            <ul class="list-disc space-y-1 pl-5">
                                <li>불법·사행성·성인물 등 부적합 콘텐츠</li>
                                <li>과도한 애니메이션이나 색상으로 사용자 불편을 주는 소재</li>
                                <li>클릭 유도형 "다크 패턴" (예: 가짜 닫기 버튼 등)</li>
                                <li>일반 게시판에 홍보글 작성 (직접홍보게시판 전용)</li>
                            </ul>
                            <a
                                href="/content/contract"
                                class="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                            >
                                <FileText class="h-3 w-3" /> 자세한 규정 보기
                            </a>
                        {:else if faq.question === '노출 수는 보장되나요?'}
                            <p class="mb-3 font-medium">
                                전체 배너 슬롯 노출은 보장되나, 광고주 수에 따라 개별 노출은
                                변동됩니다.
                            </p>
                            <div class="space-y-2 text-xs">
                                <div>
                                    <strong>긴배너 Premium+Standard 합산</strong>
                                    <ul class="list-disc pl-5">
                                        <li>전체 슬롯: 3,400만 노출</li>
                                        <li>광고주 2개: 각 1,700만 노출</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>네모배너</strong>
                                    <ul class="list-disc pl-5">
                                        <li>전체 슬롯: 1,000만 노출 / 광고주 1개: 1,000만 노출</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>미니배너</strong>
                                    <ul class="list-disc pl-5">
                                        <li>전체 슬롯: 1,600만 노출 / 광고주 1개: 1,600만 노출</li>
                                    </ul>
                                </div>
                            </div>
                            <div
                                class="bg-primary/10 text-primary mt-3 rounded-lg p-2 text-xs font-medium"
                            >
                                실시간 대시보드로 투명하게 확인 가능합니다.
                            </div>
                        {:else}
                            <p>{faq.answer}</p>
                        {/if}
                    </Accordion.Content>
                </Accordion.Item>
            {/each}
        </Accordion.Root>
    </section>

    <!-- 참고 사항 -->
    <div class="bg-primary/5 border-primary/20 mb-8 rounded-xl border p-6">
        <h5 class="text-primary mb-3 flex items-center gap-2 font-semibold">
            <Info class="h-5 w-5" /> 참고 사항
        </h5>
        <ul class="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
            <li>모든 광고는 검토 후 게재되며, 부적합한 광고는 게재가 거부될 수 있습니다.</li>
            <li>광고 효과는 소재, 타이밍, 상품에 따라 다를 수 있습니다.</li>
            <li>기재된 노출 수치는 Google Analytics 기준이며, 실제 수치는 변동될 수 있습니다.</li>
        </ul>
    </div>
</div>

<style>
    .section-title {
        position: relative;
        text-align: center;
        font-size: 1.5rem;
        line-height: 2rem;
        font-weight: 700;
        color: var(--color-foreground);
    }

    .section-title::after {
        content: '';
        display: block;
        width: 3rem;
        height: 0.125rem;
        margin: 0.75rem auto 0;
        border-radius: 9999px;
        background-color: var(--color-primary);
    }
</style>
