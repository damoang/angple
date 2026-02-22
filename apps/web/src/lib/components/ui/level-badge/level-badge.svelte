<script lang="ts">
    interface Props {
        level: number | undefined | null;
        size?: 'sm' | 'md';
    }

    const { level, size = 'md' }: Props = $props();

    const MAX_LEVEL = 109;

    let normalizedLevel = $derived(level == null ? 1 : Math.max(0, Math.min(level, MAX_LEVEL)));

    let dimensions = $derived(
        size === 'sm' ? { width: 11, height: 11 } : { width: 13, height: 13 }
    );
</script>

<img
    src="/images/level/{normalizedLevel}.svg?v=2"
    alt="Lv.{normalizedLevel}"
    width={dimensions.width}
    height={dimensions.height}
    class="level-badge inline-block align-text-bottom"
    loading="lazy"
/>
