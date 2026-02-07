<script lang="ts">
    /**
     * 나눔 위젯
     * 진행중인 나눔 목록을 2x4 그리드로 표시
     * Soft Modern 디자인 가이드라인 적용
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';
    import Gift from '@lucide/svelte/icons/gift';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import Users from '@lucide/svelte/icons/users';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    // 위젯 설정
    const itemCount = (config?.settings?.item_count as number) || 8;

    interface GivingItem {
        id: number;
        title: string;
        thumbnail: string;
        link: string;
        participants: number;
        end_time: string;
        is_urgent: boolean;
    }

    let givings = $state<GivingItem[]>([]);
    let loading = $state(true);
    let error = $state(false);

    const noImage = 'https://damoang.net/theme/damoang/img/no_image.gif';

    onMount(async () => {
        if (prefetchData) {
            givings = prefetchData as GivingItem[];
            loading = false;
            return;
        }

        try {
            const res = await fetch(`/api/giving?limit=${itemCount}`);
            if (res.ok) {
                const data = await res.json();
                givings = data.data ?? [];
            } else {
                error = true;
            }
        } catch {
            error = true;
        } finally {
            loading = false;
        }
    });

    function formatParticipants(count: number): string {
        if (count >= 1000) return '999+';
        return count.toString();
    }
</script>

<div class="bg-background border-border overflow-hidden rounded-xl border shadow-sm">
    <!-- 헤더 -->
    <div class="bg-muted/50 border-border flex items-center gap-2 border-b px-4 py-2.5">
        <div class="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg">
            <Gift class="text-primary h-4 w-4" />
        </div>
        <span class="text-foreground flex-1 text-sm font-medium">진행 중 나눔</span>
        <a
            href="/giving"
            class="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-xs transition-colors"
        >
            <span>{givings.length}건</span>
            <ChevronRight class="h-3 w-3" />
        </a>
    </div>

    <!-- 본문 -->
    <div class="p-3">
        {#if loading}
            <div class="grid grid-cols-4 gap-2">
                {#each Array(itemCount) as _}
                    <div class="bg-muted aspect-[1/1.15] animate-pulse rounded-lg"></div>
                {/each}
            </div>
        {:else if error || givings.length === 0}
            <div class="py-6 text-center">
                <Gift class="text-muted-foreground/50 mx-auto mb-2 h-10 w-10" />
                <p class="text-muted-foreground text-sm">진행중인 나눔이 없습니다.</p>
            </div>
        {:else}
            <div class="grid grid-cols-4 gap-2">
                {#each givings.slice(0, itemCount) as giving (giving.id)}
                    <a
                        href={giving.link}
                        class="group relative overflow-hidden rounded-lg transition-all duration-200 hover:-translate-y-0.5"
                        class:ring-2={giving.is_urgent}
                        class:ring-red-400={giving.is_urgent}
                    >
                        <div class="aspect-[1/1.15] overflow-hidden rounded-lg">
                            <img
                                src={giving.thumbnail || noImage}
                                alt={giving.title}
                                class="h-full w-full object-cover transition-opacity group-hover:opacity-95"
                                loading="lazy"
                                onerror={(e) => {
                                    (e.target as HTMLImageElement).src = noImage;
                                }}
                            />
                        </div>
                        <!-- 참여자 수 배지 -->
                        {#if giving.participants > 0}
                            <div
                                class="absolute bottom-1 right-1 flex items-center gap-0.5 text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                                class:text-yellow-300={giving.is_urgent}
                            >
                                <Users class="h-3 w-3" />
                                <span>{formatParticipants(giving.participants)}</span>
                            </div>
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    img {
        display: block;
    }
</style>
