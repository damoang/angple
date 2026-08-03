<script lang="ts">
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import { page } from '$app/state';

    // #1599: 사업자/저작권 정보는 사이트별 설정(angple_sites.business)에서.
    // 미설정 사이트는 사업자 블록 미렌더 (신규/미등록 사이트가 타 회사 정보 노출 방지).
    // damoang 등 기본 사이트는 site.business 미설정 시 아래 DEFAULT_BUSINESS 폴백.
    const DEFAULT_BUSINESS = {
        company: '주식회사 에스디케이(SDK)',
        ceo: '김선도',
        business_no: '871-81-03242',
        ecommerce_no: '2026-삼도1동-0015',
        address: '제주특별자치도 제주시 남성로 127, 4층',
        email: 'contact@damoang.net',
        report_email: 'jebo@damoang.net',
        copyright: 'SDK Co., Ltd.',
        copyright_url: 'https://sdkcorp.com',
        powered_by: true
    };
    // site.business 가 명시적으로 설정된 사이트는 그 값만 사용(폴백 X).
    // site 자체가 없거나(기본 다모앙) business 키가 없으면 DEFAULT 사용.
    const biz = $derived(page.data.site?.business ?? (page.data.site ? null : DEFAULT_BUSINESS));

    /**
     * 앱 스토어 링크와 QR.
     * QR SVG 는 `static/qr/` 의 정적 파일이며, 생성 시 실제 디코딩으로 URL 일치를 검증했다.
     * 주소를 바꾸면 QR 도 다시 만들어야 한다 — `triage/tools/gen_app_qr.py`.
     */
    const appStores = [
        {
            name: 'Google Play',
            href: 'https://play.google.com/store/apps/details?id=net.damoang.community',
            qr: '/qr/play.svg'
        },
        {
            name: 'App Store',
            href: 'https://apps.apple.com/kr/app/id6765814344',
            qr: '/qr/appstore.svg'
        }
    ];

    /**
     * 사업자·연락처 줄은 마크업의 {#if} 가 아니라 여기서 문자열로 조립한다.
     *
     * ⛔ 인접한 {#if} 로 되돌리지 말 것. 하이드레이션이 통째로 깨진다.
     *
     *    {#if} 는 SSR HTML 에 <!--[--> … <!--]--> 마커를 남긴다. 조건을 나란히
     *    이어 쓰면 마커가 맨텍스트만 사이에 두고 <!--]--><!--[--> 로 맞붙는다.
     *    번역 확장이나 브라우저 내장 번역이 그 텍스트 노드를 감싸는 순간
     *    앵커가 이웃 마커를 읽어 분기 판정이 어긋나고, 뒤따르는 마커가 연쇄로
     *    한 칸씩 밀린다. 종착점이 Svelte skip_nodes() 의 null 참조이고,
     *    거기서 화면이 통째로 다시 그려진다("되다 안 되다 한다"의 정체).
     *
     *    푸터는 모든 페이지에 있어서 피해가 사이트 전체로 퍼진다.
     *    2026-07-29 실측: 하이드레이션 실패 스택이 이 지점 한 곳으로 수렴했고,
     *    12시간당 약 2,000명이 영향을 받았다. 회사명·주소는 번역기가 가장 먼저
     *    건드리는 텍스트라 하필 이곳이 제일 취약했다.
     *
     *    같은 원리의 선행 조치: 목록 레이아웃 grid → flex 전환(#1885).
     */
    const bizLine = $derived(
        biz
            ? [
                  biz.company,
                  biz.ceo && `대표: ${biz.ceo}`,
                  biz.business_no && `사업자등록번호: ${biz.business_no}`,
                  biz.ecommerce_no && `통신판매업신고: ${biz.ecommerce_no}`
              ]
                  .filter(Boolean)
                  .join(' | ')
            : ''
    );

    const contactLine = $derived(
        biz
            ? [biz.address, biz.email, biz.report_email && `제보: ${biz.report_email}`]
                  .filter(Boolean)
                  .join(' | ')
            : ''
    );

    type FooterLink = { name: string; href: string; external?: boolean };

    // 서비스
    const serviceLinks: FooterLink[] = [
        { name: '앙지도', href: '/angmap' },
        { name: '앙티티', href: '/angtt' },
        { name: '앙뮤직', href: '/music' },
        { name: '미니게임', href: '/games' },
        { name: '포인트 안내', href: '/point' },
        { name: '뱃지/레벨 안내', href: '/level' },
        // ⛔ '새글' 고정. 이 기능은 헤더 '피드' / 푸터 '새글모음' / 페이지 제목
        //    '새글 모아보기' 로 이름이 셋이었고, 바로 옆 메뉴가 '모아보기'(/explore)라
        //    회원이 둘을 구분하지 못했다. 헤더 라벨은 menus 테이블(id=10008)에 있다.
        { name: '새글', href: '/feed' }
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
        { name: '광고/바이럴 신고', href: '/nope' },
        { name: '이용제한 기록', href: '/disciplinelog' }
    ];

    const sections = [
        { title: '서비스', links: serviceLinks },
        { title: '커뮤니티', links: communityLinks },
        { title: '안내', links: operationLinks }
    ];

    // 외부 링크 (아이콘 한 줄)
    const externalLinks = [
        { name: '스마트스토어', href: 'https://smartstore.naver.com/damoang-net/' },
        { name: '마플샵', href: 'https://marpple.shop/kr/dma' },
        { name: '유튜브', href: 'https://www.youtube.com/@damoangnet' },
        { name: 'X', href: 'https://x.com/@damoang_net' },
        { name: '후원', href: 'https://damoang.benecent.org' }
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

        <!--
            앱 설치 안내 (#앱배지).

            ⛔ 조건부 렌더링({#if})을 쓰지 않는다. 이 파일 상단 주석 참조 —
               푸터의 인접 {#if} 가 하이드레이션을 통째로 깨뜨려 12시간당 약 2,000명이
               영향을 받은 이력이 있다(2026-07-29). 푸터는 전 페이지에 있어 피해가
               사이트 전체로 퍼진다.
            → 모바일/PC 분기는 **CSS(sm: 브레이크포인트)만으로** 한다. 마크업은 항상 동일하게
               렌더되므로 SSR 과 클라이언트가 어긋날 여지가 없다.

            QR 은 정적 SVG 다(`static/qr/`). 런타임 생성·외부 요청이 없어 CSP 와 무관하고,
            생성 시 실제 디코딩으로 URL 일치를 검증했다(triage/tools/gen_app_qr.py).
        -->
        <div class="mt-6 border-t pt-4">
            <div class="mb-3 flex items-center gap-2">
                <span class="text-foreground text-xs font-medium">다모앙 앱</span>
                <span
                    class="border-primary/30 text-primary rounded border px-1.5 py-0.5 text-[10px] leading-none"
                    >베타</span
                >
            </div>

            <!-- PC: QR (폰으로 스캔). 모바일에서는 자기 기기를 스캔할 수 없으므로 숨긴다 -->
            <div class="hidden gap-6 sm:flex">
                {#each appStores as store (store.name)}
                    <a
                        href={store.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group flex flex-col items-center gap-1.5"
                    >
                        <img
                            src={store.qr}
                            alt="{store.name}에서 다모앙 앱 받기 (QR 코드)"
                            width="88"
                            height="88"
                            loading="lazy"
                            class="border-border rounded border bg-white p-1"
                        />
                        <span
                            class="text-muted-foreground group-hover:text-primary text-[11px] transition-colors"
                            >{store.name}</span
                        >
                    </a>
                {/each}
            </div>

            <!-- 모바일: 스토어로 바로 이동 -->
            <div class="flex flex-wrap gap-2 sm:hidden">
                {#each appStores as store (store.name)}
                    <a
                        href={store.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="border-border text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors"
                    >
                        {store.name}
                        <ExternalLink class="h-3 w-3" />
                    </a>
                {/each}
            </div>
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
                        href="/content/operation_policy_add"
                        class="text-muted-foreground hover:text-primary transition-colors"
                        >이용제한사유 안내</a
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

            <!--
                조건 분기의 내용은 반드시 요소로 감싼다. 마커가 <p> 에 붙어 있으면
                안쪽 텍스트가 번역기에 감싸여도 앵커가 흔들리지 않는다.
            -->
            {#if bizLine || contactLine}
                <div class="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {#if bizLine}<p>{bizLine}</p>{/if}
                    {#if contactLine}<p>{contactLine}</p>{/if}
                </div>
            {/if}

            <p class="text-muted-foreground mt-2 text-xs">
                <!--
                    중첩 {#if} 를 {:else if} 사슬로 폈다. 중첩이면 마커가 겹쳐 쌓여
                    바깥쪽이 밀릴 때 안쪽까지 함께 어긋난다. 각 분기는 <span> 안에 둔다.
                -->
                {#if biz?.copyright && biz.copyright_url}
                    <span
                        >© <a
                            href={biz.copyright_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hover:text-primary transition-colors">{biz.copyright}</a
                        ></span
                    >
                {:else if biz?.copyright}
                    <span>© {biz.copyright}</span>
                {:else}
                    <span
                        >© {new Date().getFullYear()}
                        {page.data.site?.title?.split(' - ')[0] ?? 'Angple'}</span
                    >
                {/if}
                {#if biz?.powered_by !== false}
                    <span
                        >· Powered by <a
                            href="https://angple.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hover:text-primary transition-colors">angple.com</a
                        ></span
                    >
                {/if}
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
