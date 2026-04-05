<script lang="ts">
    import ChevronDown from '@lucide/svelte/icons/chevron-down';

    type FooterLink = { name: string; href: string; external?: boolean };

    // 앙포털 메뉴
    const angportalLinks: FooterLink[] = [
        { name: '다모앙 지도 - 앙지도', href: '/angmap' },
        { name: '다모앙 평점 - 앙티티', href: '/angtt' },
        { name: '다모앙 음악 - 앙뮤직', href: '/music' },
        {
            name: '다모앙 스마트스토어',
            href: 'https://smartstore.naver.com/damoang-net/',
            external: true
        },
        { name: '다모앙 마플샵', href: 'https://marpple.shop/kr/dma', external: true },
        {
            name: '다모앙 영상 - 앙팡팡',
            href: 'https://www.youtube.com/@AngPangPang',
            external: true
        },
        { name: '미니게임', href: '/games' },
        { name: 'X (구 트위터)', href: 'https://x.com/@damoang_net', external: true }
    ];

    // 함께만들어가요 메뉴
    const togetherLinks: FooterLink[] = [
        { name: '공지사항', href: '/notice' },
        { name: '유지관리(버그제보)', href: '/bug' },
        { name: '다모앙 만들기', href: '/makeang' },
        { name: '이벤트 제안', href: '/event' },
        { name: '다모앙 개발지원 신청', href: '/discord' },
        { name: '광고상품', href: '/content/advertisement' }
    ];

    // 시스템 메뉴
    const systemLinks: FooterLink[] = [
        { name: '포인트 안내', href: '/point' },
        { name: '뱃지/레벨 안내', href: '/level' },
        { name: '새글모음', href: '/feed' }
    ];

    // 🚨삐앙삐앙🚨 메뉴
    const emergencyLinks: FooterLink[] = [
        { name: '앙리포트', href: '/report' },
        { name: '소명게시판', href: '/claim' },
        { name: '회원 신고 (누적 진실의 방)', href: '/truthroom' },
        { name: '바이럴 신고 기록 (광고 앙대앙)', href: '/nope' },
        { name: '회원 이용제한 기록', href: '/disciplinelog' }
    ];

    // 메뉴 섹션 데이터
    const sections = [
        { title: '앙포털', links: angportalLinks, titleClass: 'text-foreground' },
        { title: '함께만들어가요', links: togetherLinks, titleClass: 'text-foreground' },
        { title: '시스템', links: systemLinks, titleClass: 'text-foreground' },
        { title: '🚨삐앙삐앙🚨', links: emergencyLinks, titleClass: 'text-destructive' }
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
            <!-- 사업자 정보 -->
            <div class="text-muted-foreground mb-4 text-xs leading-relaxed">
                <p>
                    주식회사 에스디케이(SDK) | 대표: SDK | 사업자등록번호: 871-81-03242 |
                    통신판매업신고: 2024-고양일산서-1820
                </p>
                <p>
                    주소: 제주특별자치도 제주시 남성로 127, 4층 | 이메일: contact@damoang.net |
                    호스팅 제공자: Amazon Web Services
                </p>
            </div>

            <div class="text-muted-foreground space-y-2 text-sm">
                <p>
                    <a
                        href="https://sdkcorp.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="hover:text-primary transition-colors"
                        >© SDK Co., Ltd. All rights reserved.</a
                    >
                </p>
                <p>
                    제보/신고 : jebo@damoang.net, 문의(광고 그리고 모든 문의) : contact@damoang.net
                </p>
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
