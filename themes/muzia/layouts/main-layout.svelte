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
</script>

<svelte:head>
    <title>Muzia — 음악을 사랑하는 사람들의 커뮤니티</title>

    <!-- Google AdSense: 온디맨드 로딩 (muzia-ad-slot.svelte에서 처리) -->

    <!-- Google Analytics (GA4) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-790ERG9C3J"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-790ERG9C3J');
    </script>
    <meta name="description" content="Muzia는 음악을 사랑하는 사람들의 커뮤니티입니다. SNS 피드, 게시판, 미니홈피, 콘텐츠 마켓을 제공합니다." />
    <meta name="keywords" content="뮤지아, muzia, 음악, 커뮤니티, SNS, 게시판, 미니홈피" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Muzia" />
    <meta property="og:title" content="Muzia — 음악을 사랑하는 사람들의 커뮤니티" />
    <meta property="og:description" content="음악을 사랑하는 사람들의 커뮤니티. SNS 피드, 게시판, 미니홈피, 콘텐츠 마켓." />
    <meta property="og:url" content="https://muzia.io{$page.url.pathname}" />
    <meta property="og:image" content="https://muzia.net/theme/Muzia/storage/image/logo-muzia.png" />
    <meta property="og:locale" content="ko_KR" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Muzia — 음악을 사랑하는 사람들의 커뮤니티" />
    <meta name="twitter:description" content="음악을 사랑하는 사람들의 커뮤니티" />
    <meta name="twitter:image" content="https://muzia.net/theme/Muzia/storage/image/logo-muzia.png" />

    <!-- Canonical -->
    <link rel="canonical" href="https://muzia.io{$page.url.pathname}" />

    <style>
        /* React muzia globals.css 그대로 적용 */
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
            --muzia-gradient-from: #ec4899;
            --muzia-gradient-to: #9333ea;
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

        html {
            font-size: var(--font-size);
        }

        .muzia-theme h1 {
            font-size: 18px !important;
        }

        .muzia-theme .prose {
            font-size: 18px !important;
        }
    </style>
</svelte:head>

<div class="muzia-theme flex min-h-screen flex-col bg-background text-foreground">
    <MuziaHeader />

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
</div>
