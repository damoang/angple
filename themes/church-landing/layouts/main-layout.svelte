<script lang="ts">
    import type { Snippet } from 'svelte';
    import { page } from '$app/stores';
    import ChurchCustomize from '../components/church-customize.svelte';
    import ChurchPreview from '../components/church-preview.svelte';
    import ChurchSignup from '../components/church-signup.svelte';

    interface Props { children: Snippet; }
    const { children }: Props = $props();

    const isCustomize = $derived($page.url.pathname === '/customize');
    const isPreview = $derived($page.url.pathname === '/preview');
    const isSignup = $derived($page.url.pathname === '/signup');
    const isPricing = $derived($page.url.pathname === '/pricing');
    const isRefund = $derived($page.url.pathname === '/refund');

    const themes = [
        { id: 'grace', name: '은혜의 교회', desc: '따뜻한 우드톤, 전통적', gradient: 'from-amber-800 to-amber-500' },
        { id: 'modern', name: '모던 교회', desc: '미니멀, 세련된 다크', gradient: 'from-slate-800 to-blue-500' },
        { id: 'light', name: '빛의 교회', desc: '밝은 골드톤', gradient: 'from-amber-500 to-yellow-400' },
        { id: 'nature', name: '자연의 교회', desc: '녹색 자연 친화', gradient: 'from-emerald-600 to-emerald-400' },
        { id: 'royal', name: '로얄 교회', desc: '보라색 권위', gradient: 'from-violet-600 to-violet-400' },
        { id: 'ocean', name: '바다의 교회', desc: '블루 평화', gradient: 'from-sky-600 to-sky-400' },
        { id: 'warm', name: '따뜻한 교회', desc: '오렌지 환영', gradient: 'from-orange-600 to-orange-400' },
        { id: 'classic', name: '클래식 교회', desc: '와인색 전통', gradient: 'from-red-800 to-red-600' },
        { id: 'youth', name: '청년 교회', desc: '핑크+퍼플 활기', gradient: 'from-pink-500 to-purple-500' },
        { id: 'simple', name: '심플 교회', desc: '그레이 미니멀', gradient: 'from-slate-500 to-slate-400' },
    ];

    let openFaq = $state<number | null>(null);
    const faqs = [
        { q: '교회 홈페이지가 왜 필요한가요?', a: '온라인으로 교회 소식을 전하고, 새가족을 환영하며, 설교 영상을 공유할 수 있습니다. 코로나 이후 온라인 소통은 필수입니다.' },
        { q: '기술적 지식이 없어도 괜찮은가요?', a: '네! 저희가 모든 셋업을 해드립니다. 글 작성은 카카오톡만 할 줄 알면 충분합니다.' },
        { q: '테마를 나중에 변경할 수 있나요?', a: '물론입니다. 언제든 10가지 테마 중 원하시는 것으로 변경 가능합니다.' },
        { q: '도메인은 어떻게 연결하나요?', a: '기본으로 교회이름.church.re.kr 도메인이 제공됩니다. 기존 도메인 연결도 프로 요금제부터 지원합니다.' },
        { q: '해약은 어떻게 하나요?', a: '언제든 해약 가능하며 위약금이 없습니다. 데이터는 요청 시 백업해드립니다.' },
        { q: '설교 영상은 어떻게 올리나요?', a: 'YouTube에 업로드 후 링크만 붙여넣으면 자동으로 영상이 표시됩니다.' },
    ];
</script>

<svelte:head>
    <title>처치레(ChurchRe) — 교회 홈페이지, 쉽고 빠르게</title>
    <meta name="description" content="월 1만원으로 교회 홈페이지를 만들어 드립니다. 10가지 아름다운 테마, 설교 영상, 주보, 캘린더 기능 포함." />
    <meta property="og:title" content="처치레(ChurchRe) — 교회 홈페이지 서비스" />
    <meta property="og:description" content="월 1만원, 교회 홈페이지를 만들어 드립니다" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://church.re.kr" />
    <link rel="canonical" href="https://church.re.kr" />
</svelte:head>

{#if isCustomize}
    <ChurchCustomize />
{:else if isPreview}
    <ChurchPreview />
{:else if isSignup}
    <ChurchSignup />
{:else if isPricing}
    <!-- /pricing 요금제 상세 페이지 -->
    <div class="min-h-screen bg-white">
        <header class="border-b bg-white/95 backdrop-blur">
            <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                <a href="/" class="flex items-center gap-2">
                    <span class="text-2xl">⛪</span>
                    <span class="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-xl font-bold text-transparent">처치레</span>
                </a>
                <a href="/" class="text-sm text-gray-500 hover:text-gray-700">← 메인으로</a>
            </div>
        </header>

        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h1 class="mb-4 text-center text-3xl font-bold text-gray-900">요금제 안내</h1>
                <p class="mb-12 text-center text-gray-500">모든 요금제는 부가세(VAT) 포함 가격입니다</p>

                <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <!-- Basic -->
                    <div class="rounded-2xl border border-gray-200 p-8">
                        <h3 class="mb-2 text-xl font-bold text-gray-900">Basic</h3>
                        <p class="mb-4 text-sm text-gray-500">소규모 교회에 적합</p>
                        <div class="mb-6">
                            <span class="text-4xl font-bold text-gray-900">10,000</span>
                            <span class="text-gray-500">원/월</span>
                        </div>
                        <p class="mb-6 text-xs text-gray-400">연간 결제 시 108,000원/년 (10% 할인)</p>
                        <ul class="mb-8 space-y-3 text-sm text-gray-600">
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 커스텀 서브도메인 (교회명.church.re.kr)</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 10가지 교회 전용 테마</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> SSL 보안 인증서 (HTTPS)</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 모바일 반응형 디자인</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 설교 영상 (YouTube 연동)</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 공지사항/기도제목 게시판</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 저장공간 1GB</li>
                            <li class="flex items-start gap-2"><span class="text-gray-300">✕</span> <span class="text-gray-400">자체 도메인 연결</span></li>
                        </ul>
                        <a href="/signup" class="block rounded-lg border border-violet-500 py-3 text-center text-sm font-bold text-violet-600 transition hover:bg-violet-50">시작하기</a>
                    </div>

                    <!-- Pro -->
                    <div class="relative rounded-2xl border-2 border-violet-500 p-8 shadow-lg">
                        <div class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-4 py-1 text-xs font-bold text-white">인기</div>
                        <h3 class="mb-2 text-xl font-bold text-gray-900">Pro</h3>
                        <p class="mb-4 text-sm text-gray-500">성장하는 교회에 추천</p>
                        <div class="mb-6">
                            <span class="text-4xl font-bold text-violet-600">30,000</span>
                            <span class="text-gray-500">원/월</span>
                        </div>
                        <p class="mb-6 text-xs text-gray-400">연간 결제 시 324,000원/년 (10% 할인)</p>
                        <ul class="mb-8 space-y-3 text-sm text-gray-600">
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> Basic 요금제 모든 기능</li>
                            <li class="flex items-start gap-2"><span class="text-violet-500 font-bold">★</span> <strong>자체 도메인 연결</strong> (예: mychurch.kr)</li>
                            <li class="flex items-start gap-2"><span class="text-violet-500 font-bold">★</span> <strong>설교 영상 무제한</strong></li>
                            <li class="flex items-start gap-2"><span class="text-violet-500 font-bold">★</span> <strong>주보 PDF 업로드</strong></li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 교회 캘린더 (행사 일정)</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 새가족 등록 폼</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 저장공간 10GB</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 이메일 지원</li>
                        </ul>
                        <a href="/signup" class="block rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 py-3 text-center text-sm font-bold text-white shadow transition hover:opacity-90">시작하기</a>
                    </div>

                    <!-- Premium -->
                    <div class="rounded-2xl border border-gray-200 p-8">
                        <h3 class="mb-2 text-xl font-bold text-gray-900">Premium</h3>
                        <p class="mb-4 text-sm text-gray-500">대형 교회/맞춤 서비스</p>
                        <div class="mb-6">
                            <span class="text-4xl font-bold text-gray-900">50,000</span>
                            <span class="text-gray-500">원/월</span>
                        </div>
                        <p class="mb-6 text-xs text-gray-400">연간 결제 시 540,000원/년 (10% 할인)</p>
                        <ul class="mb-8 space-y-3 text-sm text-gray-600">
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> Pro 요금제 모든 기능</li>
                            <li class="flex items-start gap-2"><span class="text-amber-500 font-bold">★</span> <strong>전담 매니저</strong> 배정</li>
                            <li class="flex items-start gap-2"><span class="text-amber-500 font-bold">★</span> <strong>디자인 커스터마이징</strong></li>
                            <li class="flex items-start gap-2"><span class="text-amber-500 font-bold">★</span> <strong>교회 앱(PWA)</strong> 제공</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 저장공간 50GB</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 우선 기술 지원</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 데이터 백업/복원</li>
                            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> 방문 통계 분석</li>
                        </ul>
                        <a href="/signup" class="block rounded-lg border border-gray-300 py-3 text-center text-sm font-bold text-gray-700 transition hover:bg-gray-50">시작하기</a>
                    </div>
                </div>

                <!-- 결제 안내 -->
                <div class="mt-16 rounded-2xl bg-gray-50 p-8">
                    <h2 class="mb-6 text-xl font-bold text-gray-900">결제 안내</h2>
                    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <h4 class="mb-2 font-bold text-gray-700">결제 수단</h4>
                            <ul class="space-y-1 text-sm text-gray-600">
                                <li>- 신용카드/체크카드 (VISA, Mastercard, 국내 전 카드사)</li>
                                <li>- 계좌이체</li>
                                <li>- 가상계좌</li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="mb-2 font-bold text-gray-700">결제 주기</h4>
                            <ul class="space-y-1 text-sm text-gray-600">
                                <li>- 월간 결제: 매월 가입일에 자동 결제</li>
                                <li>- 연간 결제: 10% 할인 적용</li>
                                <li>- 첫 14일 무료 체험 후 결제 시작</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- 자주 묻는 질문 -->
                <div class="mt-12">
                    <h2 class="mb-6 text-xl font-bold text-gray-900">요금제 FAQ</h2>
                    <div class="space-y-4 text-sm">
                        <div class="rounded-lg border p-4">
                            <p class="font-bold text-gray-700">Q. 무료 체험 기간이 있나요?</p>
                            <p class="mt-1 text-gray-600">A. 네, 모든 요금제에 14일 무료 체험이 제공됩니다. 무료 체험 중에는 결제가 발생하지 않으며, 체험 종료 후 자동으로 결제가 시작됩니다.</p>
                        </div>
                        <div class="rounded-lg border p-4">
                            <p class="font-bold text-gray-700">Q. 요금제를 변경할 수 있나요?</p>
                            <p class="mt-1 text-gray-600">A. 네, 언제든 업그레이드/다운그레이드 가능합니다. 업그레이드 시 차액만 결제되며, 다운그레이드는 다음 결제일부터 적용됩니다.</p>
                        </div>
                        <div class="rounded-lg border p-4">
                            <p class="font-bold text-gray-700">Q. 환불은 어떻게 하나요?</p>
                            <p class="mt-1 text-gray-600">A. <a href="/refund" class="text-violet-600 underline">환불 정책</a>을 참고해주세요. 결제일로부터 7일 이내 전액 환불, 이후 일할 계산 환불이 가능합니다.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <footer class="border-t py-8 text-center text-xs text-gray-400">
            <p>주식회사 에스디케이랩스 | 서울특별시 서초구 우면동 | 사업자등록번호: 424-86-03401</p>
            <p class="mt-1">&copy; 2026 처치레(ChurchRe) All rights reserved.</p>
        </footer>
    </div>
{:else if isRefund}
    <!-- /refund 환불정책 페이지 -->
    <div class="min-h-screen bg-white">
        <header class="border-b bg-white/95 backdrop-blur">
            <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                <a href="/" class="flex items-center gap-2">
                    <span class="text-2xl">⛪</span>
                    <span class="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-xl font-bold text-transparent">처치레</span>
                </a>
                <a href="/" class="text-sm text-gray-500 hover:text-gray-700">← 메인으로</a>
            </div>
        </header>

        <section class="py-16">
            <div class="mx-auto max-w-3xl px-4">
                <h1 class="mb-2 text-3xl font-bold text-gray-900">환불 정책</h1>
                <p class="mb-10 text-sm text-gray-400">최종 수정일: 2026년 4월 6일</p>

                <div class="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">
                    <section>
                        <h2 class="text-lg font-bold text-gray-900">1. 무료 체험</h2>
                        <p>처치레(ChurchRe)는 모든 요금제에 <strong>14일 무료 체험</strong>을 제공합니다. 무료 체험 기간 중에는 결제가 발생하지 않으며, 체험 종료 전 언제든 해지할 수 있습니다. 해지 시 추가 비용이 발생하지 않습니다.</p>
                    </section>

                    <section>
                        <h2 class="text-lg font-bold text-gray-900">2. 환불 기준</h2>
                        <div class="overflow-hidden rounded-lg border">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-3 text-left font-bold">환불 시점</th>
                                        <th class="px-4 py-3 text-left font-bold">환불 금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="border-t"><td class="px-4 py-3">결제일로부터 7일 이내</td><td class="px-4 py-3 font-bold text-green-600">전액 환불</td></tr>
                                    <tr class="border-t"><td class="px-4 py-3">결제일로부터 7일 초과</td><td class="px-4 py-3">잔여 기간 일할 계산 환불</td></tr>
                                    <tr class="border-t"><td class="px-4 py-3">연간 결제 (7일 이내)</td><td class="px-4 py-3 font-bold text-green-600">전액 환불</td></tr>
                                    <tr class="border-t"><td class="px-4 py-3">연간 결제 (7일 초과)</td><td class="px-4 py-3">잔여 월수 기준 환불 (월 정가 기준 차감)</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 class="text-lg font-bold text-gray-900">3. 환불 절차</h2>
                        <ol class="list-inside list-decimal space-y-2">
                            <li><strong>환불 신청</strong>: 고객센터 이메일(<a href="mailto:support@church.re.kr" class="text-violet-600 underline">support@church.re.kr</a>) 또는 카카오톡 채널(@처치레)로 환불 요청</li>
                            <li><strong>본인 확인</strong>: 가입 이메일 및 서브도메인 확인</li>
                            <li><strong>환불 처리</strong>: 신청일로부터 영업일 기준 3~5일 내 처리</li>
                            <li><strong>환불 완료</strong>: 카드사/은행에 따라 2~5영업일 내 계좌 반영</li>
                        </ol>
                    </section>

                    <section>
                        <h2 class="text-lg font-bold text-gray-900">4. 환불이 제한되는 경우</h2>
                        <ul class="list-inside list-disc space-y-1">
                            <li>서비스 이용약관 위반으로 이용이 정지된 경우</li>
                            <li>프로모션/할인 적용 결제의 경우 할인 전 정가 기준으로 차감 후 환불</li>
                        </ul>
                    </section>

                    <section>
                        <h2 class="text-lg font-bold text-gray-900">5. 해지 후 데이터</h2>
                        <ul class="list-inside list-disc space-y-1">
                            <li>해지 시 서비스 이용 기간 종료일까지 사이트 유지</li>
                            <li>종료 후 30일간 데이터 보관 (복구 요청 가능)</li>
                            <li>30일 경과 후 데이터 영구 삭제</li>
                            <li>해지 전 데이터 백업 요청 시 무료로 제공</li>
                        </ul>
                    </section>

                    <section>
                        <h2 class="text-lg font-bold text-gray-900">6. 연락처</h2>
                        <div class="rounded-lg bg-gray-50 p-4">
                            <p><strong>처치레(ChurchRe) 고객센터</strong></p>
                            <p>이메일: <a href="mailto:support@church.re.kr" class="text-violet-600 underline">support@church.re.kr</a></p>
                            <p>운영시간: 평일 09:00 ~ 18:00 (공휴일 제외)</p>
                            <p>사업자: 주식회사 에스디케이랩스 (424-86-03401)</p>
                        </div>
                    </section>
                </div>
            </div>
        </section>

        <footer class="border-t py-8 text-center text-xs text-gray-400">
            <p>주식회사 에스디케이랩스 | 서울특별시 서초구 우면동 | 사업자등록번호: 424-86-03401</p>
            <p class="mt-1">&copy; 2026 처치레(ChurchRe) All rights reserved.</p>
        </footer>
    </div>
{:else}
<div class="min-h-screen bg-white">
    <!-- 1. Header -->
    <header class="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-2">
                <span class="text-2xl">⛪</span>
                <span class="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-xl font-bold text-transparent">처치레</span>
            </a>
            <div class="hidden items-center gap-6 md:flex">
                <a href="#features" class="text-sm text-gray-600 hover:text-gray-900">기능</a>
                <a href="#how-it-works" class="text-sm text-gray-600 hover:text-gray-900">사용법</a>
                <a href="#themes" class="text-sm text-gray-600 hover:text-gray-900">테마</a>
                <a href="#pricing" class="text-sm text-gray-600 hover:text-gray-900">요금</a>
                <a href="#faq" class="text-sm text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
            <a href="#contact" class="rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">시작하기</a>
        </div>
    </header>

    <!-- 2. Hero -->
    <section class="relative overflow-hidden bg-gradient-to-br from-violet-600 via-blue-600 to-indigo-700 py-32 text-center text-white">
        <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.4%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
        <div class="relative mx-auto max-w-4xl px-4">
            <div class="mb-6 text-6xl">⛪</div>
            <h1 class="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">교회 홈페이지,<br/>쉽고 빠르게</h1>
            <p class="mx-auto mb-10 max-w-2xl text-lg opacity-90">10가지 아름다운 테마 중 선택하세요.<br/>설교 영상, 주보, 캘린더까지 — 월 1만원이면 충분합니다.</p>
            <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a href="#contact" class="rounded-full bg-white px-8 py-4 text-lg font-bold text-violet-600 shadow-lg transition hover:shadow-xl">무료 상담 신청</a>
                <a href="#themes" class="rounded-full border-2 border-white/30 px-8 py-4 text-lg font-medium backdrop-blur transition hover:bg-white/10">테마 둘러보기</a>
            </div>
        </div>
    </section>

    <!-- 3. Stats Bar (NEW) -->
    <section class="border-b bg-gray-50 py-8">
        <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-4 text-center md:gap-16">
            {#each [
                ['200+', '교회 운영'],
                ['99.9%', '가동률'],
                ['10가지', '테마'],
                ['24시간', '기술 지원'],
            ] as [num, label]}
                <div>
                    <div class="text-2xl font-bold text-violet-600">{num}</div>
                    <div class="text-sm text-gray-500">{label}</div>
                </div>
            {/each}
        </div>
    </section>

    <!-- 4. Features -->
    <section id="features" class="py-20">
        <div class="mx-auto max-w-6xl px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">✨ 모든 것이 포함되어 있습니다</h2>
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each [
                    ['📖', '설교 영상', 'YouTube 링크만 넣으면 자동으로 영상이 표시됩니다'],
                    ['📢', '공지사항/주보', '교회 소식을 쉽게 게시하고 관리할 수 있습니다'],
                    ['📅', '교회 캘린더', '예배, 행사, 모임 일정을 한눈에 보여줍니다'],
                    ['🙏', '기도 제목', '성도들이 함께 기도 제목을 나눌 수 있습니다'],
                    ['📱', '모바일 최적화', '스마트폰에서도 완벽하게 보입니다'],
                    ['🔒', 'HTTPS 보안', 'SSL 인증서가 기본 포함됩니다'],
                ] as [icon, title, desc]}
                    <div class="rounded-xl border p-6 text-center transition hover:shadow-lg">
                        <div class="mb-3 text-4xl">{icon}</div>
                        <h3 class="mb-2 text-lg font-bold">{title}</h3>
                        <p class="text-sm text-gray-500">{desc}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- 5. How It Works (NEW) -->
    <section id="how-it-works" class="bg-gray-50 py-20">
        <div class="mx-auto max-w-4xl px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">🚀 3단계로 시작하세요</h2>
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {#each [
                    ['1', '🎨', '테마 선택', '10가지 아름다운 테마 중\n교회 분위기에 맞는 것을 고르세요'],
                    ['2', '✏️', '정보 입력', '교회 이름, 예배 시간, 연락처 등\n기본 정보만 알려주세요'],
                    ['3', '🎉', '바로 시작', '24시간 이내에 교회 홈페이지가\n완성됩니다'],
                ] as [num, icon, title, desc]}
                    <div class="relative text-center">
                        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-blue-500 text-2xl font-bold text-white">{num}</div>
                        <div class="mb-2 text-3xl">{icon}</div>
                        <h3 class="mb-2 text-lg font-bold">{title}</h3>
                        <p class="whitespace-pre-line text-sm text-gray-500">{desc}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- 6. Theme Showcase -->
    <section id="themes" class="py-20">
        <div class="mx-auto max-w-6xl px-4">
            <h2 class="mb-4 text-center text-3xl font-bold">🎨 10가지 아름다운 테마</h2>
            <p class="mb-12 text-center text-gray-500">우리 교회에 맞는 테마를 선택하세요</p>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {#each themes as t}
                    <div class="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-xl hover:ring-2 hover:ring-violet-300">
                        <a href="https://{t.id}.church.re.kr" target="_blank" class="relative block overflow-hidden">
                            <img src="https://muzia.net/data/church-screenshots/{t.id}.png" alt="{t.name}" class="h-40 w-full object-cover object-top transition-transform group-hover:scale-105" />
                            <div class="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                                <span class="rounded-full bg-white px-4 py-2 text-xs font-bold text-violet-600 opacity-0 shadow-lg transition group-hover:opacity-100">미리보기 →</span>
                            </div>
                        </a>
                        <div class="p-3">
                            <h3 class="text-sm font-bold">{t.name}</h3>
                            <p class="mb-2 text-xs text-gray-400">{t.desc}</p>
                            <a href="/customize?theme=church-{t.id}" class="inline-block rounded bg-violet-100 px-2 py-1 text-[10px] font-medium text-violet-600 transition hover:bg-violet-200">커스터마이징 →</a>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- 7. Testimonials (NEW) -->
    <section class="bg-gray-50 py-20">
        <div class="mx-auto max-w-4xl px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">💬 목사님들의 후기</h2>
            <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                {#each [
                    { name: '김은혜 목사', church: '소망교회', quote: '기술에 대해 전혀 모르는데도 하루 만에 홈페이지가 완성되었습니다. 성도님들이 정말 좋아하세요.' },
                    { name: '박신실 목사', church: '새벽교회', quote: '설교 영상을 올리기가 너무 쉽습니다. YouTube 링크만 넣으면 끝이에요. 매주 주보도 바로 올립니다.' },
                    { name: '이영광 목사', church: '빛의교회', quote: '월 1만원에 이 정도 퀄리티라니 놀랍습니다. 다른 교회에도 추천하고 있어요.' },
                ] as t}
                    <div class="rounded-xl border bg-white p-6 shadow-sm">
                        <div class="mb-4 text-3xl text-violet-200">"</div>
                        <p class="mb-4 text-sm leading-relaxed text-gray-600">{t.quote}</p>
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-400 to-blue-400 text-sm font-bold text-white">{t.name[0]}</div>
                            <div>
                                <div class="text-sm font-bold">{t.name}</div>
                                <div class="text-xs text-gray-400">{t.church}</div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- 8. Pricing -->
    <section id="pricing" class="py-20">
        <div class="mx-auto max-w-4xl px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">💰 합리적인 요금</h2>
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div class="rounded-2xl border p-8 text-center">
                    <h3 class="mb-2 text-lg font-bold">기본</h3>
                    <div class="mb-4"><span class="text-4xl font-bold">1만원</span><span class="text-gray-400">/월</span></div>
                    <ul class="mb-6 space-y-2 text-left text-sm text-gray-600">
                        <li>✅ 교회 홈페이지</li><li>✅ 테마 선택</li><li>✅ 게시판/공지</li><li>✅ 모바일 최적화</li><li>✅ SSL 보안</li>
                    </ul>
                    <a href="#contact" class="block rounded-lg border px-4 py-2 font-medium transition hover:bg-gray-50">선택하기</a>
                </div>
                <div class="relative rounded-2xl border-2 border-violet-500 p-8 text-center shadow-lg">
                    <div class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-3 py-0.5 text-xs font-bold text-white">인기</div>
                    <h3 class="mb-2 text-lg font-bold">프로</h3>
                    <div class="mb-4"><span class="text-4xl font-bold">3만원</span><span class="text-gray-400">/월</span></div>
                    <ul class="mb-6 space-y-2 text-left text-sm text-gray-600">
                        <li>✅ 기본 전체 포함</li><li>✅ PWA 앱 제공</li><li>✅ 커스텀 도메인</li><li>✅ 설교 영상 아카이브</li><li>✅ 우선 지원</li>
                    </ul>
                    <a href="#contact" class="block rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 font-medium text-white transition hover:opacity-90">선택하기</a>
                </div>
                <div class="rounded-2xl border p-8 text-center">
                    <h3 class="mb-2 text-lg font-bold">프리미엄</h3>
                    <div class="mb-4"><span class="text-4xl font-bold">5만원</span><span class="text-gray-400">/월</span></div>
                    <ul class="mb-6 space-y-2 text-left text-sm text-gray-600">
                        <li>✅ 프로 전체 포함</li><li>✅ iOS/Android 앱</li><li>✅ 푸시 알림</li><li>✅ 맞춤 디자인</li><li>✅ 전담 매니저</li>
                    </ul>
                    <a href="#contact" class="block rounded-lg border px-4 py-2 font-medium transition hover:bg-gray-50">문의하기</a>
                </div>
            </div>
        </div>
    </section>

    <!-- 9. FAQ (NEW) -->
    <section id="faq" class="bg-gray-50 py-20">
        <div class="mx-auto max-w-2xl px-4">
            <h2 class="mb-12 text-center text-3xl font-bold">❓ 자주 묻는 질문</h2>
            <div class="space-y-3">
                {#each faqs as faq, i}
                    <div class="overflow-hidden rounded-lg border bg-white">
                        <button class="flex w-full items-center justify-between p-4 text-left font-medium transition hover:bg-gray-50" onclick={() => openFaq = openFaq === i ? null : i}>
                            <span>{faq.q}</span>
                            <span class="text-gray-400 transition-transform {openFaq === i ? 'rotate-180' : ''}">{openFaq === i ? '▲' : '▼'}</span>
                        </button>
                        {#if openFaq === i}
                            <div class="border-t px-4 py-3 text-sm text-gray-600">{faq.a}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- 10. Contact Form -->
    <section id="contact" class="py-20">
        <div class="mx-auto max-w-lg px-4 text-center">
            <h2 class="mb-4 text-3xl font-bold">📞 무료 상담 신청</h2>
            <p class="mb-8 text-gray-500">교회 이름과 연락처를 남겨주시면 연락드리겠습니다</p>
            <form class="space-y-4 text-left">
                <input type="text" placeholder="교회 이름" class="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400" />
                <input type="text" placeholder="담당자 이름" class="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400" />
                <input type="tel" placeholder="연락처" class="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400" />
                <select class="w-full rounded-lg border px-4 py-3 text-gray-500 outline-none focus:ring-2 focus:ring-violet-400">
                    <option>요금제 선택</option>
                    <option>기본 (월 1만원)</option>
                    <option selected>프로 (월 3만원) — 추천</option>
                    <option>프리미엄 (월 5만원)</option>
                </select>
                <button type="submit" class="w-full rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 py-3 font-bold text-white transition hover:opacity-90">상담 신청하기</button>
                <p class="text-center text-xs text-gray-400">제출 시 개인정보처리방침에 동의합니다</p>
            </form>
        </div>
    </section>

    <!-- 11. Footer -->
    <footer class="border-t py-8">
        <div class="mx-auto max-w-6xl px-4 text-center">
            <div class="mb-2 flex items-center justify-center gap-2">
                <span class="text-xl">⛪</span>
                <span class="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text font-bold text-transparent">처치레(ChurchRe)</span>
            </div>
            <p class="text-xs text-gray-400">주식회사 에스디케이랩스 | 서울특별시 서초구 우면동 | 사업자등록번호: 424-86-03401</p>
            <p class="mt-1 text-xs text-gray-400">&copy; 2026 처치레(ChurchRe) All rights reserved.</p>
        </div>
    </footer>
</div>
{/if}
