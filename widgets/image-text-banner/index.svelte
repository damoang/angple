<script lang="ts">
    /**
     * 이미지+텍스트 배너 위젯
     * g5_write_banners 테이블에서 활성 배너를 2x2 그리드로 표시
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import ImageIcon from '@lucide/svelte/icons/image';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    interface Banner {
        id: number;
        image: string;
        link: string;
        text: string;
    }

    let banners = $state<Banner[]>([]);
    let loading = $state(true);
    let error = $state(false);

    onMount(async () => {
        if (prefetchData) {
            banners = prefetchData as Banner[];
            loading = false;
            return;
        }

        try {
            const res = await fetch('/api/widgets/image-text-banner?limit=4');
            if (res.ok) {
                const data = await res.json();
                banners = data.data ?? [];
            } else {
                error = true;
            }
        } catch {
            error = true;
        } finally {
            loading = false;
        }
    });
</script>

<div class="bg-background border-border overflow-hidden rounded-xl border shadow-sm">
    <!-- 헤더 -->
    <div class="bg-muted/50 border-border flex items-center gap-2 border-b px-4 py-2.5">
        <div class="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg">
            <LayoutGrid class="text-primary h-4 w-4" />
        </div>
        <span class="text-foreground flex-1 text-sm font-medium">추천</span>
    </div>

    <!-- 본문 -->
    <div class="p-3">
        {#if loading}
            <div class="grid grid-cols-2 gap-2">
                {#each Array(4) as _}
                    <div class="bg-muted h-24 animate-pulse rounded-xl"></div>
                {/each}
            </div>
        {:else if error || banners.length === 0}
            <div class="text-muted-foreground py-4 text-center text-sm">
                <ImageIcon class="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>배너가 준비 중입니다</p>
            </div>
        {:else}
            <div class="grid grid-cols-2 gap-2">
                {#each banners as banner (banner.id)}
                    <a
                        href={banner.link || 'javascript:void(0)'}
                        target={banner.link?.startsWith('http') ? '_blank' : undefined}
                        rel={banner.link?.startsWith('http') ? 'noopener noreferrer nofollow' : undefined}
                        class="group border-border hover:border-primary bg-background block overflow-hidden rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5"
                    >
                        {#if banner.image}
                            <figure class="m-0">
                                <img
                                    src={banner.image}
                                    alt={banner.text || '배너'}
                                    class="h-20 w-full object-cover object-center transition-opacity group-hover:opacity-95"
                                    loading="lazy"
                                />
                                {#if banner.text}
                                    <figcaption
                                        class="text-primary bg-background truncate px-2 py-1.5 text-center text-xs"
                                    >
                                        {banner.text}
                                    </figcaption>
                                {/if}
                            </figure>
                        {:else}
                            <div class="bg-muted/30 flex h-20 items-center justify-center px-2">
                                <span class="text-primary text-center text-xs">{banner.text}</span>
                            </div>
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    figure {
        margin: 0;
    }

    img {
        display: block;
    }
</style>
