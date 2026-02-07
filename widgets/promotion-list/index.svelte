<script lang="ts">
    /**
     * 직접홍보 목록 위젯
     * damoang-ads API에서 현재 활성 직접홍보 광고주를 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    const ADS_API = import.meta.env.VITE_ADS_API_URL || 'https://ads.damoang.net';

    interface ServedPromotion {
        advertiserName: string;
        memberId: string;
        postCount: number;
        pinToTop: boolean;
    }

    let promotions = $state<ServedPromotion[]>([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            const res = await fetch(`${ADS_API}/api/v1/serve/promotions`);
            if (res.ok) {
                const json = await res.json();
                promotions = json.data?.promotions ?? [];
            }
        } catch {
            // 조용히 실패
        } finally {
            loading = false;
        }
    });
</script>

{#if loading}
    <div class="space-y-2">
        {#each [1, 2, 3] as _}
            <div class="h-8 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        {/each}
    </div>
{:else if promotions.length > 0}
    <div class="promo-list">
        <div class="promo-header">
            <span class="promo-icon">📢</span>
            <span class="promo-title">직접홍보</span>
            <span class="promo-count">{promotions.length}명</span>
        </div>
        <ul class="promo-items">
            {#each promotions as promo}
                <li class="promo-item" class:pinned={promo.pinToTop}>
                    <a
                        href="/bbs/board.php?bo_table=promotion&sca=&sfl=mb_id%2C1&stx={promo.memberId}"
                        class="promo-link"
                    >
                        {#if promo.pinToTop}
                            <span class="pin-badge">📌</span>
                        {/if}
                        <span class="promo-name">{promo.advertiserName}</span>
                        <span class="promo-post-count">{promo.postCount}건</span>
                    </a>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<style>
    .promo-list {
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        background: white;
    }

    .promo-header {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        font-weight: 600;
        font-size: 0.8rem;
    }

    .promo-icon {
        flex-shrink: 0;
    }

    .promo-title {
        flex: 1;
    }

    .promo-count {
        font-size: 0.7rem;
        opacity: 0.85;
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 8px;
    }

    .promo-items {
        list-style: none;
        margin: 0;
        padding: 4px 0;
    }

    .promo-item {
        border-bottom: 1px solid #f0f0f0;
    }

    .promo-item:last-child {
        border-bottom: none;
    }

    .promo-link {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        text-decoration: none;
        color: #333;
        font-size: 0.8rem;
        transition: background 0.15s;
    }

    .promo-link:hover {
        background: #f5f5ff;
    }

    .pinned .promo-link {
        background: #fefce8;
    }

    .pinned .promo-link:hover {
        background: #fef9c3;
    }

    .pin-badge {
        flex-shrink: 0;
        font-size: 0.7rem;
    }

    .promo-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
    }

    .promo-post-count {
        flex-shrink: 0;
        font-size: 0.7rem;
        color: #888;
    }

    :global(.dark) .promo-list {
        background: #2d2d2d;
    }
    :global(.dark) .promo-item {
        border-color: #444;
    }
    :global(.dark) .promo-link {
        color: #eee;
    }
    :global(.dark) .promo-link:hover {
        background: #3d3d5c;
    }
    :global(.dark) .pinned .promo-link {
        background: #3d3d2d;
    }
    :global(.dark) .pinned .promo-link:hover {
        background: #4d4d2d;
    }
</style>
