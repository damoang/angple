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
    let mobileExpanded = $state(false);
    let shouldLoad = $state(false);
    let desktopExpanded = $state(false);
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

    function getTargetHeight(): number {
        if (!browser) return DESKTOP_AD_MAX_HEIGHT;
        return window.matchMedia('(max-width: 639px)').matches
            ? MOBILE_AD_MAX_HEIGHT
            : DESKTOP_AD_MAX_HEIGHT;
    }

    function enforceClipHeight(): void {
        if (!clipWrapper) return;
        const h = getTargetHeight();
        const target = `${h}px`;
        if (
            clipWrapper.style.getPropertyValue('height') === target &&
            clipWrapper.style.getPropertyPriority('height') === 'important' &&
            clipWrapper.style.getPropertyValue('max-height') === target &&
            clipWrapper.style.getPropertyValue('min-height') === target
        )
            return;
        clipWrapper.style.setProperty('min-height', target, 'important');
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

    // 사용자가 패널을 직접 펼칠 때만 활동 API 호출
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

    function toggleDesktopExpanded(): void {
        desktopExpanded = !desktopExpanded;
        if (desktopExpanded) {
            shouldLoad = true;
        }
    }

    function toggleMobileExpanded(): void {
        mobileExpanded = !mobileExpanded;
        if (mobileExpanded) {
            shouldLoad = true;
        }
    }

    onMount(() => {
        let mutationObserver: MutationObserver | undefined;
        let resizeObserver: ResizeObserver | undefined;
        const handleResize = () => enforceClipHeight();

        loadAdSense();

        requestAnimationFrame(() => {
            if (!clipWrapper) return;
            enforceClipHeight();
            mutationObserver = new MutationObserver(() => enforceClipHeight());
            mutationObserver.observe(clipWrapper, {
                attributes: true,
                attributeFilter: ['style']
            });

            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(() => enforceClipHeight());
                resizeObserver.observe(clipWrapper);
                if (panelEl) resizeObserver.observe(panelEl);
            } else {
                window.addEventListener('resize', handleResize);
            }
        });

        return () => {
            mutationObserver?.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    });
</script>

{#if post.author_id && !post.deleted_at}
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3" bind:this={panelEl}>
        <!-- AdSense 광고 -->
        <div class="flex flex-col">
            <!-- 외부 클리핑 래퍼: MutationObserver로 AdSense의 height 덮어쓰기 방어 -->
            <!-- 모바일: max-height 100px로 제한 / 데스크톱: 카드 높이에 맞춤 -->
            <div
                bind:this={clipWrapper}
                class="ad-clip-wrapper overflow-hidden rounded-xl"
                style="position: relative;"
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

        <Card class="hidden gap-0 sm:col-span-2 sm:flex">
            <CardHeader class="pb-2 pt-2">
                <button
                    type="button"
                    class="text-foreground flex w-full items-center justify-between text-sm font-semibold"
                    onclick={toggleDesktopExpanded}
                >
                    작성자 최근 활동
                    {#if desktopExpanded}
                        <ChevronUp class="h-4 w-4" />
                    {:else}
                        <ChevronDown class="h-4 w-4" />
                    {/if}
                </button>
            </CardHeader>
            {#if desktopExpanded}
                <CardContent class="grid grid-cols-2 gap-4 pb-2 pt-0">
                    <div>
                        <h4 class="text-foreground mb-2 text-sm font-semibold">최근 글</h4>
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
                    </div>
                    <div>
                        <h4 class="text-foreground mb-2 text-sm font-semibold">최근 댓글</h4>
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
                                                const hash = c.href.split('#')[1];
                                                if (
                                                    hash &&
                                                    window.location.pathname ===
                                                        c.href.split('#')[0]
                                                ) {
                                                    e.preventDefault();
                                                    const el = document.getElementById(hash);
                                                    if (el) {
                                                        el.scrollIntoView({
                                                            behavior: 'smooth',
                                                            block: 'start'
                                                        });
                                                        el.style.transition =
                                                            'background-color 0.3s ease';
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
                    </div>
                </CardContent>
            {/if}
        </Card>
    </div>

    <!-- 모바일: 작성자 활동 접기/펼치기 -->
    <div class="mb-4 sm:hidden">
        <button
            type="button"
            onclick={toggleMobileExpanded}
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
                <Card class="gap-0">
                    <CardHeader class="pb-0 pt-2">
                        <h4 class="text-foreground text-xs font-semibold">최근 글</h4>
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
                <Card class="gap-0">
                    <CardHeader class="pb-0 pt-2">
                        <h4 class="text-foreground text-xs font-semibold">최근 댓글</h4>
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
        {/if}
    </div>
{/if}

<style>
    /* 모바일은 낮게, 데스크톱은 카드형 비율로 보이도록 높이를 제한합니다. */
    .ad-clip-wrapper {
        min-height: 110px;
        height: 110px;
        max-height: 110px;
        background: hsl(var(--background));
        isolation: isolate;
    }
    @media (min-width: 640px) {
        .ad-clip-wrapper {
            min-height: 214px;
            height: 214px;
            max-height: 214px;
        }
    }
</style>
