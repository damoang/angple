<script lang="ts">
    /**
     * 나눔 위젯 (사이드바 컴팩트)
     * 공지사항 위젯과 동일한 스타일로 진행중인 나눔 목록을 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';
    import Gift from '@lucide/svelte/icons/gift';
    import Clock from '@lucide/svelte/icons/clock';
    import Users from '@lucide/svelte/icons/users';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    interface GivingItem {
        id: number;
        title: string;
        extra_5: string; // end time
        participant_count: string;
        is_urgent: boolean;
    }

    let items = $state<GivingItem[]>([]);
    let loading = $state(true);
    let error = $state(false);

    // 카운트다운용 현재 시각
    let now = $state(Date.now());
    $effect(() => {
        const interval = setInterval(() => {
            now = Date.now();
        }, 1000);
        return () => clearInterval(interval);
    });

    onMount(async () => {
        try {
            const res = await fetch('/api/plugins/giving/list?tab=active&limit=5&sort=urgent');
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    items = data.data || [];
                }
            } else {
                error = true;
            }
        } catch {
            error = true;
        } finally {
            loading = false;
        }
    });

    function formatCountdown(endTimeStr: string): string {
        const end = new Date(endTimeStr).getTime();
        const diff = end - now;
        if (diff <= 0) return '종료';
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        if (h >= 24) {
            const d = Math.floor(h / 24);
            return `${d}일`;
        }
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
</script>

<div class="border-border bg-background rounded-xl border p-4">
    <h3 class="text-foreground mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Gift class="h-4 w-4 text-emerald-500" />
        나눔
        <a
            href="/giving"
            class="text-muted-foreground ml-auto text-[10px] font-normal hover:underline"
            >전체보기</a
        >
    </h3>

    {#if loading}
        <ul class="space-y-2">
            {#each Array(3) as _}
                <li class="bg-muted h-4 animate-pulse rounded"></li>
            {/each}
        </ul>
    {:else if error || items.length === 0}
        <p class="text-muted-foreground py-2 text-center text-xs">진행중인 나눔이 없어요</p>
    {:else}
        <ul class="text-muted-foreground space-y-2 text-xs">
            {#each items as item (item.id)}
                <li class="flex items-center gap-1.5">
                    <a
                        href="/giving/{item.id}"
                        class="hover:text-primary min-w-0 flex-1 truncate transition-colors hover:underline"
                    >
                        • {item.title}
                    </a>
                    {#if item.extra_5}
                        <span
                            class="shrink-0 font-mono text-[10px] {item.is_urgent
                                ? 'font-semibold text-red-500'
                                : 'text-muted-foreground'}"
                        >
                            {formatCountdown(item.extra_5)}
                        </span>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</div>
