<script lang="ts">
    import type { Snippet } from 'svelte';
    import { page } from '$app/stores';
    import MuziaHeader from '../components/muzia-header.svelte';
    import MuziaSidebar from '../components/muzia-sidebar.svelte';
    import MuziaFooter from '../components/muzia-footer.svelte';
    import MuziaFeed from '../components/muzia-feed.svelte';
    import MuziaAttendance from '../components/muzia-attendance.svelte';
    import MuziaContentPage from '../components/muzia-content-page.svelte';
    import MuziaPostDetail from '../components/muzia-post-detail.svelte';
    import MuziaAdSlot from '../components/muzia-ad-slot.svelte';

    interface Props {
        children: Snippet;
    }

    const { children }: Props = $props();

    const pathname = $derived($page.url.pathname);
    const isHomePage = $derived(pathname === '/');
    const isAttendancePage = $derived(pathname === '/attendance');

    // 차단된 게시판 (정책 위반 콘텐츠)
    const blockedBoards = ['black', 'archive', 'cp_qna', 'cp_forum', 'cp_forum2', 'piano'];
    const isBlockedBoard = $derived(blockedBoards.some(b => pathname === '/' + b || pathname.startsWith('/' + b + '/')));
    const contentPageId = $derived(
        pathname === '/privacy' ? 'privacy'
        : pathname === '/terms' ? 'provision'
        : pathname === '/disclaimer' ? 'disclaimer'
        : pathname === '/company' ? 'company'
        : pathname === '/about' ? 'company'
        : null
    );

    // 게시글 상세 감지: /boardId/postId 패턴 (postId가 숫자)
    const postMatch = $derived(() => {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
            return { boardId: parts[0], postId: parts[1] };
        }
        return null;
    });
    const isPostDetail = $derived(postMatch() !== null);

    // 타이틀에서 "다모앙" → "Muzia" 교체
    $effect(() => {
        if (typeof document !== 'undefined') {
            const t = document.title;
            if (t && t.includes('다모앙')) {
                document.title = t.replace(/다모앙/g, 'Muzia');
            }
        }
    });
</script>

<svelte:head>
    <title>뮤지아(Muzia) — 음악을 사랑하는 사람들의 커뮤니티 | Since 2002</title>

    <!-- SEO: 구조화된 데이터 (Organization + WebSite + SiteNavigationElement) -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://muzia.net/#organization",
                "name": "Muzia",
                "alternateName": "뮤지아",
                "url": "https://muzia.net",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://muzia.net/logo-muzia.png"
                },
                "foundingDate": "2002-03-15",
                "description": "2002년부터 이어져 온 대한민국 대표 음악 커뮤니티. 시벨리우스, 피날레, 도리코 등 사보 프로그램 전문.",
                "contactPoint": {
                    "@type": "ContactPoint",
                    "email": "help@muzia.net",
                    "contactType": "customer service"
                }
            },
            {
                "@type": "WebSite",
                "@id": "https://muzia.net/#website",
                "name": "뮤지아(Muzia) — 음악을 사랑하는 사람들의 커뮤니티",
                "url": "https://muzia.net",
                "publisher": { "@id": "https://muzia.net/#organization" },
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": "https://muzia.net/search?q={search_term_string}",
                    "query-input": "required name=search_term_string"
                }
            },
            {
                "@type": "SiteNavigationElement",
                "name": ["Q&A", "포럼", "음악", "시벨리우스", "도리코", "바이올린", "출석부"],
                "url": [
                    "https://muzia.net/qna",
                    "https://muzia.net/forum",
                    "https://muzia.net/music",
                    "https://muzia.net/sibelius",
                    "https://muzia.net/dorico",
                    "https://muzia.net/violin",
                    "https://muzia.net/attendance"
                ]
            }
        ]
    }
    </script>

    <!-- Pretendard 폰트 (preload로 렌더링 차단 방지) -->
    <link rel="preload" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" as="style" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />

    <!-- 테마 모드 깜빡임 방지 (SSR 시 즉시 적용) -->
    <script>
        (function() {
            var m = localStorage.getItem('muzia-theme-mode') || 'system';
            var h = document.documentElement;
            h.classList.remove('dark', 'amoled');
            if (m === 'dark') h.classList.add('dark');
            else if (m === 'amoled') { h.classList.add('dark'); h.classList.add('amoled'); }
            else if (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) h.classList.add('dark');
        })();
    </script>

    <!-- Google AdSense: 온디맨드 로딩 (muzia-ad-slot.svelte에서 처리) -->

    <!-- Google Analytics (GA4) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-790ERG9C3J"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-790ERG9C3J');
    </script>
    <meta name="description" content="뮤지아(Muzia)는 2002년부터 이어져 온 대한민국 대표 음악 커뮤니티입니다. 시벨리우스, 피날레, 도리코 등 사보 프로그램과 작곡, 편곡, MIDI, 음악 이론을 다루는 전문 커뮤니티." />
    <meta name="keywords" content="뮤지아, muzia, 음악 커뮤니티, 시벨리우스, 피날레, 도리코, 사보 프로그램, 작곡, 편곡, MIDI, DAW" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="뮤지아(Muzia)" />
    <meta property="og:title" content="뮤지아(Muzia) — 음악을 사랑하는 사람들의 커뮤니티 | Since 2002" />
    <meta property="og:description" content="2002년부터 이어져 온 대한민국 대표 음악 커뮤니티. 시벨리우스, 피날레, 도리코 등 사보 프로그램 전문." />
    <meta property="og:url" content="https://muzia.net{$page.url.pathname}" />
    <meta property="og:image" content="https://muzia.net/logo-muzia.png" />
    <meta property="og:locale" content="ko_KR" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="뮤지아(Muzia) — 음악을 사랑하는 사람들의 커뮤니티 | Since 2002" />
    <meta name="twitter:description" content="2002년부터 이어져 온 대한민국 대표 음악 커뮤니티" />
    <meta name="twitter:image" content="https://muzia.net/logo-muzia.png" />

    <!-- Canonical -->
    <link rel="canonical" href="https://muzia.net{$page.url.pathname}" />

    <style>
        :root {
            --font-size: 16px;
            --background: #ffffff;
            --foreground: oklch(0.145 0 0);
            --card: #ffffff;
            --card-foreground: oklch(0.145 0 0);
            --popover: oklch(1 0 0);
            --popover-foreground: oklch(0.145 0 0);
            --primary: #030213;
            --primary-foreground: oklch(1 0 0);
            --secondary: oklch(0.95 0.0058 264.53);
            --secondary-foreground: #030213;
            --muted: #ececf0;
            --muted-foreground: #717182;
            --accent: #e9ebef;
            --accent-foreground: #030213;
            --destructive: #d4183d;
            --destructive-foreground: #ffffff;
            --border: rgba(0, 0, 0, 0.1);
            --input: transparent;
            --input-background: #f3f3f5;
            --switch-background: #cbced4;
            --font-weight-medium: 500;
            --font-weight-normal: 400;
            --ring: oklch(0.708 0 0);
            --radius: 0.625rem;
            --sidebar: oklch(0.985 0 0);
            --sidebar-foreground: oklch(0.145 0 0);
            --sidebar-primary: #030213;
            --sidebar-primary-foreground: oklch(0.985 0 0);
            --sidebar-accent: oklch(0.97 0 0);
            --sidebar-accent-foreground: oklch(0.205 0 0);
            --sidebar-border: oklch(0.922 0 0);
            --sidebar-ring: oklch(0.708 0 0);

            /* Muzia 전용 */
            --muzia-gradient-from: #6366f1;
            --muzia-gradient-to: #8b5cf6;
        }

        .dark {
            --background: oklch(0.145 0 0);
            --foreground: oklch(0.985 0 0);
            --card: oklch(0.145 0 0);
            --card-foreground: oklch(0.985 0 0);
            --popover: oklch(0.145 0 0);
            --popover-foreground: oklch(0.985 0 0);
            --primary: oklch(0.985 0 0);
            --primary-foreground: oklch(0.205 0 0);
            --secondary: oklch(0.269 0 0);
            --secondary-foreground: oklch(0.985 0 0);
            --muted: oklch(0.269 0 0);
            --muted-foreground: oklch(0.708 0 0);
            --accent: oklch(0.269 0 0);
            --accent-foreground: oklch(0.985 0 0);
            --destructive: oklch(0.396 0.141 25.723);
            --destructive-foreground: oklch(0.637 0.237 25.331);
            --border: oklch(0.269 0 0);
            --input: oklch(0.269 0 0);
            --ring: oklch(0.439 0 0);
            --sidebar: oklch(0.205 0 0);
            --sidebar-foreground: oklch(0.985 0 0);
            --sidebar-primary: oklch(0.488 0.243 264.376);
            --sidebar-primary-foreground: oklch(0.985 0 0);
            --sidebar-accent: oklch(0.269 0 0);
            --sidebar-accent-foreground: oklch(0.985 0 0);
            --sidebar-border: oklch(0.269 0 0);
            --sidebar-ring: oklch(0.439 0 0);
        }

        .amoled {
            --background: #000000;
            --foreground: #e8e8e8;
            --card: #0a0a0a;
            --card-foreground: #e8e8e8;
            --popover: #000000;
            --popover-foreground: #e8e8e8;
            --primary: #e8e8e8;
            --primary-foreground: #000000;
            --secondary: #111111;
            --secondary-foreground: #e8e8e8;
            --muted: #111111;
            --muted-foreground: #888888;
            --accent: #111111;
            --accent-foreground: #e8e8e8;
            --border: #1a1a1a;
            --input: #1a1a1a;
            --ring: #333333;
            --sidebar: #000000;
            --sidebar-foreground: #e8e8e8;
            --sidebar-primary: #e8e8e8;
            --sidebar-primary-foreground: #000000;
            --sidebar-accent: #0a0a0a;
            --sidebar-accent-foreground: #e8e8e8;
            --sidebar-border: #1a1a1a;
            --sidebar-ring: #333333;
        }

        html {
            font-size: var(--font-size);
            font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
        }

        .muzia-theme h1 {
            font-size: 18px !important;
        }

        /* 다크 모드 전역 색상 강제 */
        .dark body, .dark .muzia-theme {
            color: #e8e8e8;
        }

        .dark .muzia-theme a {
            color: inherit;
        }

        .dark .text-foreground,
        .dark .text-gray-900,
        .dark .text-gray-800,
        .dark .text-gray-700 {
            color: #e8e8e8 !important;
        }

        .dark .bg-white,
        .dark .bg-gray-50 {
            background-color: var(--background) !important;
        }

        /* 다크모드: DB 저장 HTML (인라인 스타일) 강제 오버라이드 */
        .dark .prose td,
        .dark .prose th,
        .dark .prose p,
        .dark .prose li,
        .dark .prose div,
        .dark .prose span,
        .dark .prose h2,
        .dark .prose h3,
        .dark .prose h4 {
            color: #e8e8e8 !important;
        }

        .dark .prose a {
            color: #93c5fd !important;
        }

        .dark .prose table {
            border-color: #333 !important;
        }

        .dark .prose tr {
            border-color: #333 !important;
        }

        .dark .prose [style*="background:#f9fafb"],
        .dark .prose [style*="background-color"] {
            background-color: #1a1a1a !important;
        }
    </style>
</svelte:head>

<div class="muzia-theme flex min-h-screen flex-col bg-background text-foreground">
    <MuziaHeader />

    <!-- 좌측 윙 배너 (1440px+ only, fixed) -->
    <div class="hidden 2xl:block" style="position:fixed;left:max(0px,calc((100vw - 1440px)/2 - 180px));top:80px;z-index:10;">
        <MuziaAdSlot position="left-wing" />
    </div>

    <!-- 우측 윙 배너 (1440px+ only, fixed) -->
    <div class="hidden 2xl:block" style="position:fixed;right:max(0px,calc((100vw - 1440px)/2 - 180px));top:80px;z-index:10;">
        <MuziaAdSlot position="right-wing" />
    </div>

    <div class="container mx-auto flex flex-1">
        <!-- 사이드바 (데스크톱) -->
        <aside class="hidden w-80 flex-shrink-0 border-r border-border lg:block">
            <div class="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
                <MuziaSidebar />
            </div>
        </aside>

        <!-- 메인 콘텐츠 -->
        <main class="flex-1 transition-all duration-300">
            {#if isBlockedBoard}
                <div class="flex min-h-[50vh] items-center justify-center">
                    <div class="text-center">
                        <div class="mb-4 text-5xl">🚫</div>
                        <h1 class="mb-2 text-xl font-bold">접근할 수 없는 페이지입니다</h1>
                        <p class="text-sm text-muted-foreground">이 게시판은 비공개입니다.</p>
                        <a href="/" class="mt-4 inline-block text-sm text-primary hover:underline">홈으로 돌아가기</a>
                    </div>
                </div>
            {:else if isHomePage}
                <MuziaFeed />
            {:else if isAttendancePage}
                <MuziaAttendance />
            {:else if contentPageId}
                <MuziaContentPage contentId={contentPageId} />
            {:else if isPostDetail}
                {@const match = postMatch()}
                {#if match}
                    <MuziaPostDetail boardId={match.boardId} postId={match.postId} />
                {/if}
            {:else}
                <MuziaAdSlot position="leaderboard" />
                {@render children()}
                <MuziaAdSlot position="content" />
            {/if}
        </main>
    </div>

    <MuziaFooter />

    <!-- 모바일 하단 고정 배너 (lg 미만만) -->
    <div class="fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-background/95 py-1 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] backdrop-blur lg:hidden" id="mobile-bottom-ad">
        <MuziaAdSlot position="mobile-bottom" />
        <button class="absolute -top-6 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs text-muted-foreground shadow" onclick="document.getElementById('mobile-bottom-ad').style.display='none'">✕</button>
    </div>
</div>
