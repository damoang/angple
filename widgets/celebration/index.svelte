<script lang="ts">
    import { onMount } from 'svelte';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import { PartyPopper, ChevronRight } from '../lucide.js';
    import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import {
        mount,
        getCelebrations,
        getCurrentIndex,
        getLink
    } from '$lib/stores/celebration.svelte';

    interface Props {
        config: WidgetConfig;
        slot?: string;
        isEditMode?: boolean;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _props: Props = $props();

    // 공유 store 마운트 — CelebrationRolling/DamoangBanner 와 동일 currentIndex 로 sync.
    onMount(() => mount());

    let celebrations = $derived(getCelebrations());
    let currentIndex = $derived(getCurrentIndex());
    let current = $derived(celebrations[currentIndex]);

    // 이미지별 small 여부 (naturalWidth 기준).
    // 기본값 = undefined → img 모드 (큰 이미지 가정, 가이드 770×90).
    // onload 후 < 770 이면 small → 벽지(div, background-repeat) 모드.
    let smallById = $state<Record<number, boolean>>({});

    function checkSize(id: number, e: Event) {
        const img = e.currentTarget as HTMLImageElement;
        const isSmall = img.naturalWidth > 0 && img.naturalWidth < 770;
        if (smallById[id] !== isSmall) {
            smallById = { ...smallById, [id]: isSmall };
        }
    }

    function slideClass(i: number, idx: number): string {
        if (i === idx) return 'translate-y-0 opacity-100';
        if (i < idx) return '-translate-y-full opacity-0';
        return 'translate-y-full opacity-0';
    }
</script>

{#if celebrations.length > 0}
    <Card class="w-full gap-0 overflow-hidden">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 px-3 pb-2 pt-0">
            <div class="flex items-center gap-1.5">
                <PartyPopper class="text-primary h-4 w-4" />
                <h3 class="text-sm font-semibold">마음메시지</h3>
            </div>
            <a
                href="/message"
                class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
                더보기
                <ChevronRight class="h-3.5 w-3.5" />
            </a>
        </CardHeader>

        <CardContent class="p-0">
            <a href={current ? getLink(current) : '/message'} class="block">
                <div class="bg-muted relative aspect-[77/9] w-full overflow-hidden">
                    {#each celebrations as banner, i (banner.id)}
                        {#if banner.image_url}
                            {@const isSmall = smallById[banner.id] === true}
                            {@const slide = slideClass(i, currentIndex)}
                            <!--
                                동시 렌더 (깜박임 0):
                                - img: 큰 이미지일 때 노출 (object-contain). onload 시 dimension 검사.
                                - div: 작은 이미지일 때 노출 (background-repeat 벽지 패턴).
                                두 element 의 opacity 만 swap → reflow 없음.
                            -->
                            <img
                                src={banner.image_url}
                                alt={banner.target_member_nick || '마음메시지'}
                                onload={(e) => checkSize(banner.id, e)}
                                class="absolute inset-0 h-full w-full object-contain transition-all duration-500 ease-in-out {slide} {isSmall
                                    ? 'opacity-0'
                                    : ''}"
                                loading="lazy"
                            />
                            {#if isSmall}
                                <div
                                    role="img"
                                    aria-label={banner.target_member_nick || '마음메시지'}
                                    style:background-image="url({banner.image_url})"
                                    class="absolute inset-0 h-full w-full bg-center bg-repeat transition-all duration-500 ease-in-out {slide}"
                                ></div>
                            {/if}
                        {/if}
                    {/each}
                    {#if current?.target_member_nick}
                        <div
                            class="absolute bottom-0 right-0 max-w-[90%] truncate px-1.5 py-0.5 text-right text-xs font-bold text-white [text-shadow:_-1px_-1px_0_rgba(0,0,0,0.6),_1px_-1px_0_rgba(0,0,0,0.6),_-1px_1px_0_rgba(0,0,0,0.6),_1px_1px_0_rgba(0,0,0,0.6)]"
                        >
                            {current.target_member_nick}
                        </div>
                    {/if}
                </div>
            </a>
        </CardContent>
    </Card>
{/if}
