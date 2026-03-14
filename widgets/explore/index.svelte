<script lang="ts">
    /**
     * 톺아보기 위젯 (메인 페이지용)
     * 핫 모드 상위 10건 표시 + 더보기 → /explore
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import ExplorePreview from '$lib/components/features/explore/explore-preview.svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();
</script>

<ExplorePreview {prefetchData} />
