<script lang="ts">
    interface Props {
        level: number | undefined | null;
        size?: 'sm' | 'md';
    }

    const { level, size = 'md' }: Props = $props();

    const MAX_LEVEL = 109;

    let isBot = $derived(level === -1);
    let normalizedLevel = $derived(level == null ? 1 : Math.max(0, Math.min(level, MAX_LEVEL)));

    let dimensions = $derived(
        size === 'sm' ? { width: 11, height: 11 } : { width: 13, height: 13 }
    );
</script>

{#if isBot}
    <img
        src="/images/level/bot.svg?v=1"
        alt="AI Bot"
        width={dimensions.width}
        height={dimensions.height}
        class="level-badge inline-block align-text-bottom"
        loading="lazy"
    />
{:else}
    <img
        src="/images/level/{normalizedLevel}.svg?v=2"
        alt="Lv.{normalizedLevel}"
        width={dimensions.width}
        height={dimensions.height}
        class="level-badge inline-block align-text-bottom"
        loading="lazy"
    />
{/if}
