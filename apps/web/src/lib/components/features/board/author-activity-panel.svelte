<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import type { FreePost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ChevronUp from '@lucide/svelte/icons/chevron-up';
    import { formatDate } from '$lib/utils/format-date.js';
    import { slide } from 'svelte/transition';

    interface RecentPost {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
        deleted_at?: string | null;
    }

    interface RecentComment {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        parent_wr_id: number;
        preview: string;
        wr_datetime: string;
        href: string;
        deleted_at?: string | null;
        post_deleted_at?: string | null;
    }

    interface Props {
        post: FreePost;
    }

    let { post }: Props = $props();

    let loading = $state(true);
    let recentPosts = $state<RecentPost[]>([]);
    let recentComments = $state<RecentComment[]>([]);
    let adContainer = $state<HTMLElement | null>(null);
    let clipWrapper = $state<HTMLElement | null>(null);
    let panelEl = $state<HTMLElement | null>(null);
    let panelHeight = $state(160);
    let mobileExpanded = $state(false);
    let shouldLoad = $state(false);
    let observer: IntersectionObserver | null = null;
    const MOBILE_AD_MAX_HEIGHT = 88;
    const DESKTOP_AD_MAX_HEIGHT = 190;
    const ADSENSE_ACTIVITY_CLIENT =
        import.meta.env.VITE_ADSENSE_ACTIVITY_CLIENT || 'ca-pub-2456249131797827';
    const ADSENSE_ACTIVITY_SLOT = import.meta.env.VITE_ADSENSE_ACTIVITY_SLOT || '1893595467';

    function getRecentPostLabel(post: RecentPost): string {
        return post.deleted_at ? '삭제된 글입니다.' : post.wr_subject || '(제목 없음)';
    }

    function getRecentCommentLabel(comment: RecentComment): string {
        if (comment.deleted_at) return '삭제된 댓글입니다.';
        if (comment.post_deleted_at) return `[삭제된 글] ${comment.preview || '(내용 없음)'}`;
        return comment.preview || '(내용 없음)';
    }

    function enforceClipHeight(): void {
        if (!clipWrapper || panelHeight <= 20) return;
        const isMobile = browser ? window.matchMedia('(max-width: 639px)').matches : false;
        const availableHeight = Math.max(panelHeight - 20, 0);
        const h = isMobile
            ? Math.min(availableHeight, MOBILE_AD_MAX_HEIGHT)
            : Math.min(availableHeight, DESKTOP_AD_MAX_HEIGHT);
        const target = `${h}px`;
        if (
            clipWrapper.style.getPropertyValue('height') === target &&
            clipWrapper.style.getPropertyPriority('height') === 'important'
        )
            return;
        clipWrapper.style.setProperty('height', target, 'important');
        clipWrapper.style.setProperty('max-height', target, 'important');
    }

    function loadAdSense(): void {
        if (!browser || !adContainer) return;

        const adsenseClient = ADSENSE_ACTIVITY_CLIENT;
        if (!adsenseClient) return; // 환경변수 미설정 시 광고 미표시

        if (!document.querySelector(`script[src*="${adsenseClient}"]`)) {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }

        try {
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch {
            // AdSense 초기화 실패 시 무시
        }
    }

    // 패널이 실제로 보일 때만 활동 API 호출
    $effect(() => {
        const authorId = post.author_id;
        if (!browser || !authorId) {
            loading = false;
            return;
        }
        if (!shouldLoad) {
            loading = false;
            return;
        }

        loading = true;
        recentPosts = [];
        recentComments = [];

        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/members/${authorId}/activity?limit=5`, {
                    signal: controller.signal
                });
                if (res.ok && !controller.signal.aborted) {
                    const data = await res.json();
                    recentPosts = data.recentPosts ?? [];
                    recentComments = data.recentComments ?? [];
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                // 실패 시 조용히 처리
            } finally {
                if (!controller.signal.aborted) loading = false;
            }
        })();

        return () => {
            controller.abort();
        };
    });

    onMount(() => {
        // 카드 높이 측정 후 광고 높이 맞추기
        let mutationObserver: MutationObserver | undefined;

        if (panelEl && typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(
                (entries) => {
                    if (!entries.some((entry) => entry.isIntersecting)) return;
                    shouldLoad = true;
                    loadAdSense();
                    observer?.disconnect();
                    observer = null;
                },
                { rootMargin: '240px 0px' }
            );
            observer.observe(panelEl);
        } else {
            shouldLoad = true;
            loadAdSense();
        }

        requestAnimationFrame(() => {
            if (panelEl) {
                const cards = panelEl.querySelectorAll('[data-slot="card"]');
                if (cards.length > 0) {
                    const cardHeight = (cards[0] as HTMLElement).offsetHeight;
                    if (cardHeight > 0) panelHeight = cardHeight;
                }
            }

            if (clipWrapper) {
                enforceClipHeight();
                mutationObserver = new MutationObserver(() => enforceClipHeight());
                mutationObserver.observe(clipWrapper, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        });

        return () => {
            mutationObserver?.disconnect();
            observer?.disconnect();
        };
    });
</script>

{#if post.author_id}
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3" bind:this={panelEl}>
        <!-- AdSense 광고 -->
        <div class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-500">AD</span>
            <!-- 외부 클리핑 래퍼: MutationObserver로 AdSense의 height 덮어쓰기 방어 -->
            <!-- 모바일: max-height 100px로 제한 / 데스크톱: 카드 높이에 맞춤 -->
            <div
                bind:this={clipWrapper}
                class="ad-clip-wrapper overflow-hidden rounded-xl"
                style="clip-path: inset(0); position: relative;"
            >
                <!-- AdSense가 이 div의 height를 !important로 바꿔도 외부 래퍼가 잘라냄 -->
                <div bind:this={adContainer}>
                    {#if ADSENSE_ACTIVITY_CLIENT && ADSENSE_ACTIVITY_SLOT}
                        <ins
                            class="adsbygoogle"
                            style="display:block;"
                            data-ad-client={ADSENSE_ACTIVITY_CLIENT}
                            data-ad-slot={ADSENSE_ACTIVITY_SLOT}
                            data-ad-format="auto"
                            data-full-width-responsive="true"
                        ></ins>
                    {/if}
                </div>
            </div>
        </div>

        <!-- 최근 글 (데스크톱: 항상 표시) -->
        <Card class="hidden gap-0 sm:flex">
            <CardHeader class="pb-0 pt-2">
                <h4 class="text-foreground text-sm font-semibold">작성자 최근 글</h4>
            </CardHeader>
            <CardContent class="pb-2 pt-0">
                {#if loading}
                    <div class="flex justify-center py-4">
                        <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                    </div>
                {:else if recentPosts.length === 0}
                    <p class="text-muted-foreground py-2 text-xs">자료 없음</p>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each recentPosts as p (`${p.bo_table}_${p.wr_id}`)}
                            <li class="py-1">
                                <a
                                    href={p.href}
                                    class="text-foreground hover:text-primary block min-w-0 truncate text-xs"
                                >
                                    {getRecentPostLabel(p)}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </CardContent>
        </Card>

        <!-- 최근 댓글 (데스크톱: 항상 표시) -->
        <Card class="hidden gap-0 sm:flex">
            <CardHeader class="pb-0 pt-2">
                <h4 class="text-foreground text-sm font-semibold">작성자 최근 댓글</h4>
            </CardHeader>
            <CardContent class="pb-2 pt-0">
                {#if loading}
                    <div class="flex justify-center py-4">
                        <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                    </div>
                {:else if recentComments.length === 0}
                    <p class="text-muted-foreground py-2 text-xs">자료 없음</p>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each recentComments as c (`${c.bo_table}_${c.wr_id}`)}
                            <li class="py-1">
                                <a
                                    href={c.href}
                                    class="text-foreground hover:text-primary block min-w-0 truncate text-xs"
                                    onclick={(e) => {
                                        // 같은 페이지 내 앵커 클릭 시 스크롤 처리
                                        const hash = c.href.split('#')[1];
                                        if (
                                            hash &&
                                            window.location.pathname === c.href.split('#')[0]
                                        ) {
                                            e.preventDefault();
                                            const el = document.getElementById(hash);
                                            if (el) {
                                                el.scrollIntoView({
                                                    behavior: 'smooth',
                                                    block: 'start'
                                                });
                                                // 하이라이트 효과
                                                el.style.transition = 'background-color 0.3s ease';
                                                el.style.backgroundColor =
                                                    'hsl(var(--primary) / 0.1)';
                                                el.style.borderRadius = '0.5rem';
                                                setTimeout(() => {
                                                    el.style.backgroundColor = '';
                                                    setTimeout(() => {
                                                        el.style.transition = '';
                                                        el.style.borderRadius = '';
                                                    }, 300);
                                                }, 2000);
                                            }
                                        }
                                    }}
                                >
                                    {getRecentCommentLabel(c)}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </CardContent>
        </Card>
    </div>

    <!-- 모바일: 작성자 활동 접기/펼치기 -->
    {#if !loading && (recentPosts.length > 0 || recentComments.length > 0)}
        <div class="mb-4 sm:hidden">
            <button
                onclick={() => (mobileExpanded = !mobileExpanded)}
                class="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 py-1.5 text-xs transition-colors"
            >
                작성자 최근 활동
                {#if mobileExpanded}
                    <ChevronUp class="h-3.5 w-3.5" />
                {:else}
                    <ChevronDown class="h-3.5 w-3.5" />
                {/if}
            </button>
            {#if mobileExpanded}
                <div class="grid grid-cols-2 gap-2" transition:slide={{ duration: 200 }}>
                    {#if recentPosts.length > 0}
                        <Card class="gap-0">
                            <CardHeader class="pb-0 pt-2">
                                <h4 class="text-foreground text-xs font-semibold">최근 글</h4>
                            </CardHeader>
                            <CardContent class="pb-2 pt-0">
                                <ul class="divide-border divide-y">
                                    {#each recentPosts as p (`${p.bo_table}_${p.wr_id}`)}
                                        <li class="py-1">
                                            <a
                                                href={p.href}
                                                class="text-foreground hover:text-primary block min-w-0 truncate text-xs"
                                            >
                                                {getRecentPostLabel(p)}
                                            </a>
                                        </li>
                                    {/each}
                                </ul>
                            </CardContent>
                        </Card>
                    {/if}
                    {#if recentComments.length > 0}
                        <Card class="gap-0">
                            <CardHeader class="pb-0 pt-2">
                                <h4 class="text-foreground text-xs font-semibold">최근 댓글</h4>
                            </CardHeader>
                            <CardContent class="pb-2 pt-0">
                                <ul class="divide-border divide-y">
                                    {#each recentComments as c (`${c.bo_table}_${c.wr_id}`)}
                                        <li class="py-1">
                                            <a
                                                href={c.href}
                                                class="text-foreground hover:text-primary block min-w-0 truncate text-xs"
                                            >
                                                {getRecentCommentLabel(c)}
                                            </a>
                                        </li>
                                    {/each}
                                </ul>
                            </CardContent>
                        </Card>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
{/if}

<style>
    /* 모바일은 낮게, 데스크톱은 카드형 비율로 보이도록 높이를 제한합니다. */
    .ad-clip-wrapper {
        max-height: 88px;
    }
    @media (min-width: 640px) {
        .ad-clip-wrapper {
            max-height: 190px;
        }
    }
</style>
