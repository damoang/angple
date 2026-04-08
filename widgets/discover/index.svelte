<script lang="ts">
    /**
     * 모아보기 위젯 (메인 페이지용)
     * 핫 모드 상위 10건 표시 + 더보기 → /discover
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import DiscoverPreview from '$lib/components/features/discover/discover-preview.svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();
</script>

<DiscoverPreview {prefetchData} />
