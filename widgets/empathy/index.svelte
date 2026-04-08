<script lang="ts">
    /**
     * 추천 글 위젯
     * SSR prefetch 데이터가 있으면 즉시 표시, 없으면 자체 fetch
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { EmpathyPosts } from '$lib/components/features/empathy';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();
</script>

<EmpathyPosts {prefetchData} />
