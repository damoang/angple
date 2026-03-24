<script lang="ts">
    /**
     * 제휴 링크 배지 컴포넌트
     * 링크 옆에 표시되어 제휴 링크임을 알림
     */

    interface Props {
        platform: string;
        showIcon?: boolean;
        showText?: boolean;
    }

    let { platform, showIcon = true, showText = false }: Props = $props();

    const platformNames: Record<string, string> = {
        coupang: '쿠팡',
        aliexpress: '알리익스프레스',
        amazon: '아마존',
        kkday: 'KKday',
        linkprice: '제휴'
    };

    const platformName = $derived(platformNames[platform] || platform);
</script>

<span
    class="affiliate-badge"
    title="{platformName} 제휴 링크"
    data-platform={platform}
>
    {#if showIcon}
        <span class="affiliate-badge-icon">💰</span>
    {/if}
    {#if showText}
        <span class="affiliate-badge-text">{platformName}</span>
    {/if}
</span>

<style>
    .affiliate-badge {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-left: 4px;
        font-size: 0.85em;
        vertical-align: middle;
        cursor: help;
    }

    .affiliate-badge-icon {
        display: inline-block;
    }

    .affiliate-badge-text {
        font-size: 0.75em;
        color: var(--color-text-muted, #666);
        background: var(--color-bg-subtle, #f5f5f5);
        padding: 1px 4px;
        border-radius: 3px;
    }

    /* 다크모드 */
    :global(.dark) .affiliate-badge-text {
        background: var(--color-bg-subtle, #333);
        color: var(--color-text-muted, #aaa);
    }
</style>
