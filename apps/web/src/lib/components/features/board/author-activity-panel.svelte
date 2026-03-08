<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import type { FreePost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import { formatDate } from '$lib/utils/format-date.js';

    interface RecentPost {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
    }

    interface RecentComment {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        parent_wr_id: number;
        preview: string;
        wr_datetime: string;
        href: string;
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

    function enforceClipHeight(): void {
        if (!clipWrapper || panelHeight <= 20) return;
        const h = panelHeight - 20;
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

        const adsenseClient = import.meta.env.VITE_ADSENSE_ACTIVITY_CLIENT || '';
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

    // SPA 네비게이션 시 author_id 변경을 감지하여 데이터 재로딩
    $effect(() => {
        const authorId = post.author_id;
        if (!browser || !authorId) {
            loading = false;
            return;
        }

        loading = true;
        recentPosts = [];
        recentComments = [];

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/members/${authorId}/activity?limit=5`);
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    recentPosts = data.recentPosts ?? [];
                    recentComments = data.recentComments ?? [];
                }
            } catch {
                // 실패 시 조용히 처리
            } finally {
                if (!cancelled) loading = false;
            }
        })();

        return () => {
            cancelled = true;
        };
    });

    onMount(() => {
        // 카드 높이 측정 후 광고 높이 맞추기 + AdSense 초기화
        let observer: MutationObserver | undefined;

        requestAnimationFrame(() => {
            if (panelEl) {
                const cards = panelEl.querySelectorAll('[data-slot="card"]');
                if (cards.length > 0) {
                    const cardHeight = (cards[0] as HTMLElement).offsetHeight;
                    if (cardHeight > 0) panelHeight = cardHeight;
                }
            }
            loadAdSense();

            if (clipWrapper) {
                enforceClipHeight();
                observer = new MutationObserver(() => enforceClipHeight());
                observer.observe(clipWrapper, { attributes: true, attributeFilter: ['style'] });
            }
        });

        return () => observer?.disconnect();
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
                style="height: {panelHeight - 20}px; clip-path: inset(0); position: relative;"
            >
                <!-- AdSense가 이 div의 height를 !important로 바꿔도 외부 래퍼가 잘라냄 -->
                <div bind:this={adContainer}>
                    {#if import.meta.env.VITE_ADSENSE_ACTIVITY_CLIENT}
                        <ins
                            class="adsbygoogle"
                            style="display:block;"
                            data-ad-client={import.meta.env.VITE_ADSENSE_ACTIVITY_CLIENT}
                            data-ad-slot={import.meta.env.VITE_ADSENSE_ACTIVITY_SLOT || ''}
                            data-ad-format="auto"
                            data-full-width-responsive="true"
                        ></ins>
                    {/if}
                </div>
            </div>
        </div>

        <!-- 최근 글 (모바일에서 숨김) -->
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
                        {#each recentPosts as p (p.wr_id)}
                            <li class="py-1">
                                <a
                                    href={p.href}
                                    class="text-foreground hover:text-primary block min-w-0 truncate text-xs"
                                >
                                    {p.wr_subject || '(제목 없음)'}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </CardContent>
        </Card>

        <!-- 최근 댓글 (모바일에서 숨김) -->
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
                        {#each recentComments as c (c.wr_id)}
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
                                    {c.preview || '(내용 없음)'}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </CardContent>
        </Card>
    </div>
{/if}

<style>
    /* 모바일에서 AdSense 높이 제한 (페이지 상단 광고 크기 축소) */
    .ad-clip-wrapper {
        max-height: 100px;
    }
    @media (min-width: 640px) {
        .ad-clip-wrapper {
            max-height: none;
        }
    }
</style>
