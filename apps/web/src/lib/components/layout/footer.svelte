<script lang="ts">
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    type FooterLink = { name: string; href: string; external?: boolean };

    // 서비스
    const serviceLinks: FooterLink[] = [
        { name: '앙지도', href: '/angmap' },
        { name: '앙티티', href: '/angtt' },
        { name: '앙뮤직', href: '/music' },
        { name: '미니게임', href: '/games' },
        { name: '포인트 안내', href: '/point' },
        { name: '뱃지/레벨 안내', href: '/level' },
        { name: '새글모음', href: '/feed' }
    ];

    // 커뮤니티
    const communityLinks: FooterLink[] = [
        { name: '공지사항', href: '/notice' },
        { name: '버그제보', href: '/bug' },
        { name: '다모앙 만들기', href: '/makeang' },
        { name: '이벤트 제안', href: '/event' },
        { name: '개발지원 신청', href: '/discord' },
        { name: '광고상품', href: '/content/advertisement' }
    ];

    // 운영
    const operationLinks: FooterLink[] = [
        { name: '앙리포트', href: '/report' },
        { name: '소명게시판', href: '/claim' },
        { name: '회원 신고', href: '/truthroom' },
        { name: '바이럴 신고', href: '/nope' },
        { name: '이용제한 기록', href: '/disciplinelog' }
    ];

    const sections = [
        { title: '서비스', links: serviceLinks },
        { title: '커뮤니티', links: communityLinks },
        { title: '운영', links: operationLinks }
    ];

    // 외부 링크 (아이콘 한 줄)
    const externalLinks = [
        { name: '스마트스토어', href: 'https://smartstore.naver.com/damoang-net/' },
        { name: '마플샵', href: 'https://marpple.shop/kr/dma' },
        { name: '앙팡팡', href: 'https://www.youtube.com/@AngPangPang' },
        { name: 'X', href: 'https://x.com/@damoang_net' }
    ];

    let openSections = $state<Set<number>>(new Set());

    function toggleSection(index: number) {
        const next = new Set(openSections);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        openSections = next;
    }
</script>

<footer class="border-border bg-canvas w-full border-t">
    <div class="mx-auto max-w-[1200px] px-4 py-8">
        <!-- 3컬럼 메뉴 -->
        <div class="grid grid-cols-1 gap-0 sm:gap-8 md:grid-cols-3">
            {#each sections as section, i (section.title)}
                <div>
                    <button
                        type="button"
                        class="flex w-full items-center justify-between py-3 sm:pointer-events-none sm:mb-4 sm:cursor-default sm:py-0"
                        onclick={() => toggleSection(i)}
                    >
                        <h3 class="text-foreground text-base font-semibold">{section.title}</h3>
                        <ChevronDown
                            class="text-muted-foreground h-5 w-5 transition-transform sm:hidden {openSections.has(
                                i
                            )
                                ? 'rotate-180'
                                : ''}"
                        />
                    </button>
                    <ul
                        class="space-y-1.5 overflow-hidden transition-all duration-200 sm:max-h-none sm:pb-0 sm:opacity-100 {openSections.has(
                            i
                        )
                            ? 'max-h-96 pb-4 opacity-100'
                            : 'max-h-0 opacity-0'}"
                    >
                        {#each section.links as link (link.href)}
                            <li>
                                <a
                                    href={link.href}
                                    class="text-muted-foreground hover:text-primary text-sm transition-colors"
                                >
                                    {link.name}
                                </a>
                            </li>
                        {/each}
                    </ul>
                    <div class="border-border border-b sm:hidden"></div>
                </div>
            {/each}
        </div>

        <!-- 외부 링크 한 줄 -->
        <div class="mt-6 flex flex-wrap gap-3 border-t pt-4">
            {#each externalLinks as link (link.href)}
                <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs transition-colors"
                >
                    {link.name}
                    <ExternalLink class="h-3 w-3" />
                </a>
            {/each}
        </div>
    </div>

    <!-- 법적 링크 + 사업자 정보 (한 섹션으로 통합) -->
    <div class="border-border border-t">
        <div class="mx-auto max-w-[1200px] px-4 py-4 text-center">
            <ul class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
                <li>
                    <a
                        href="/content/company"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >사이트 소개</a
                    >
                </li>
                <li class="text-border">·</li>
                <li>
                    <a
                        href="/content/provision"
                        class="text-muted-foreground hover:text-primary font-semibold transition-colors"
                        >이용약관</a
                    >
                </li>
                <li class="text-border">·</li>
                <li>
                    <a
                        href="/content/privacy"
                        class="text-muted-foreground hover:text-primary font-semibold transition-colors"
                        >개인정보처리방침</a
                    >
                </li>
                <li class="text-border">·</li>
                <li>
                    <a
                        href="/content/operation_policy"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >운영정책</a
                    >
                </li>
                <li class="text-border">·</li>
                <li>
                    <a
                        href="/content/contract"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >광고 운영정책</a
                    >
                </li>
            </ul>

            <div class="text-muted-foreground mt-3 text-xs leading-relaxed">
                <p>
                    주식회사 에스디케이(SDK) | 대표: SDK | 사업자등록번호: 871-81-03242 |
                    통신판매업신고: 2024-고양일산서-1820
                </p>
                <p>
                    제주특별자치도 제주시 남성로 127, 4층 | contact@damoang.net | 제보:
                    jebo@damoang.net
                </p>
            </div>

            <p class="text-muted-foreground mt-2 text-xs">
                © <a
                    href="https://sdkcorp.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-primary transition-colors">SDK Co., Ltd.</a
                >
                · Powered by
                <a
                    href="https://angple.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-primary transition-colors">angple.com</a
                >
            </p>
        </div>
    </div>
</footer>

<style>
    @media (min-width: 640px) {
        ul {
            max-height: none !important;
            opacity: 1 !important;
        }
    }
</style>
