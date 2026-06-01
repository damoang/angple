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
                <div class="bg-muted relative aspect-[8/1] w-full overflow-hidden">
                    {#each celebrations as banner, i (banner.id)}
                        {#if banner.image_url}
                            <img
                                src={banner.image_url}
                                alt={banner.target_member_nick || '마음메시지'}
                                class="absolute inset-0 h-full w-full object-contain transition-all duration-500 ease-in-out
                                    {i === currentIndex
                                    ? 'translate-y-0 opacity-100'
                                    : i < currentIndex
                                      ? '-translate-y-full opacity-0'
                                      : 'translate-y-full opacity-0'}"
                                loading="lazy"
                            />
                        {/if}
                    {/each}
                    {#if current?.target_member_nick}
                        <div
                            class="absolute inset-x-0 bottom-0 truncate px-1.5 py-0.5 text-center text-xs font-bold text-white [text-shadow:_-1px_-1px_0_rgba(0,0,0,0.6),_1px_-1px_0_rgba(0,0,0,0.6),_-1px_1px_0_rgba(0,0,0,0.6),_1px_1px_0_rgba(0,0,0,0.6)]"
                        >
                            {current.target_member_nick}
                        </div>
                    {/if}
                </div>
            </a>
        </CardContent>
    </Card>
{/if}
