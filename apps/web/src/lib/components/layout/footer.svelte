<script lang="ts">
    import ChevronDown from '@lucide/svelte/icons/chevron-down';

    type FooterLink = { name: string; href: string; external?: boolean };

    // 위키앙 메뉴 (wikiang.org 전용 — damoang 커뮤니티 메뉴 노출 방지)
    const wikiLinks: FooterLink[] = [
        { name: '대문', href: '/대문' },
        { name: '최근 바뀜', href: '/특수:최근바뀜' },
        { name: '분류', href: '/특수:분류' },
        { name: '무작위 문서', href: '/특수:무작위' },
        { name: '도움말', href: '/도움말' }
    ];

    // 위키 도구
    const toolLinks: FooterLink[] = [
        { name: '문서 작성하기', href: '/특수:새문서' },
        { name: '특수 문서 목록', href: '/특수:목록' },
        { name: '업로드 파일', href: '/특수:파일목록' }
    ];

    // 안내 메뉴
    const helpLinks: FooterLink[] = [
        { name: '위키앙 소개', href: '/content/company' },
        { name: '이용약관', href: '/content/provision' },
        { name: '개인정보처리방침', href: '/content/privacy' }
    ];

    // 메뉴 섹션 데이터
    const sections = [
        { title: '위키앙', links: wikiLinks, titleClass: 'text-foreground' },
        { title: '위키 도구', links: toolLinks, titleClass: 'text-foreground' },
        { title: '안내', links: helpLinks, titleClass: 'text-foreground' }
    ];

    // 모바일 접기 상태 관리
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
    <!-- 상단 섹션 -->
    <div class="mx-auto max-w-[1200px] px-4 py-8">
        <div class="grid grid-cols-1 gap-0 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {#each sections as section, i (section.title)}
                <div>
                    <!-- 모바일: 접기/펼치기 버튼, 데스크톱: 일반 제목 -->
                    <button
                        type="button"
                        class="flex w-full items-center justify-between py-3 sm:pointer-events-none sm:mb-4 sm:cursor-default sm:py-0"
                        onclick={() => toggleSection(i)}
                    >
                        <h3 class="{section.titleClass} text-lg font-semibold">{section.title}</h3>
                        <ChevronDown
                            class="text-muted-foreground h-5 w-5 transition-transform sm:hidden {openSections.has(
                                i
                            )
                                ? 'rotate-180'
                                : ''}"
                        />
                    </button>

                    <!-- 메뉴 리스트: 모바일에서 접기, 데스크톱에서 항상 표시 -->
                    <ul
                        class="space-y-2 overflow-hidden transition-all duration-200 sm:max-h-none sm:pb-0 sm:opacity-100 {openSections.has(
                            i
                        )
                            ? 'max-h-96 pb-4 opacity-100'
                            : 'max-h-0 opacity-0'}"
                    >
                        {#each section.links as link (link.href)}
                            <li>
                                <a
                                    href={link.href}
                                    target={link.external ? '_blank' : undefined}
                                    rel={link.external ? 'noopener noreferrer' : undefined}
                                    class="text-muted-foreground hover:text-primary text-sm transition-all duration-200 ease-out"
                                >
                                    {link.name}
                                </a>
                            </li>
                        {/each}
                    </ul>

                    <!-- 모바일 구분선 -->
                    <div class="border-border border-b sm:hidden"></div>
                </div>
            {/each}
        </div>
    </div>

    <!-- 법적 링크 섹션 -->
    <div class="border-border border-t">
        <div class="mx-auto max-w-[1200px] px-4 py-4">
            <ul class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                <li>
                    <a
                        href="/content/company"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >사이트 소개</a
                    >
                </li>
                <li>
                    <a
                        href="/content/advertisement"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >광고상품</a
                    >
                </li>
                <li>
                    <a
                        href="/content/provision"
                        class="text-muted-foreground hover:text-primary font-semibold transition-colors"
                        >이용약관</a
                    >
                </li>
                <li>
                    <a
                        href="/content/privacy"
                        class="text-muted-foreground hover:text-primary font-semibold transition-colors"
                        >개인정보처리방침</a
                    >
                </li>
                <li>
                    <a
                        href="/content/operation_policy"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >운영정책</a
                    >
                </li>
                <li>
                    <a
                        href="/content/operation_policy_add"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >이용제한사유 안내</a
                    >
                </li>
                <li>
                    <a
                        href="/content/contract"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >온사이트 광고 운영정책</a
                    >
                </li>
            </ul>
        </div>
    </div>

    <!-- 저작권 및 연락처 섹션 -->
    <div class="bg-canvas">
        <div class="mx-auto max-w-[1200px] px-4 py-6 text-center">
            <!-- 사업자 정보 (위키앙 운영 법인 — Delaware LLC) -->
            <div class="text-muted-foreground mb-4 text-xs leading-relaxed">
                <p>WIKIANG LLC | A Delaware Limited Liability Company (USA) | EIN: 30-1443167</p>
                <p>문의: sdk@sdk.kr | 호스팅 제공자: Amazon Web Services / Cloudflare</p>
            </div>

            <div class="text-muted-foreground space-y-2 text-sm">
                <p>© WIKIANG LLC. All rights reserved.</p>
            </div>

            <p class="text-muted-foreground mt-3 text-xs">
                Powered by <a
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
    /* sm 이상에서는 항상 메뉴 표시 */
    @media (min-width: 640px) {
        ul {
            max-height: none !important;
            opacity: 1 !important;
        }
    }
</style>
