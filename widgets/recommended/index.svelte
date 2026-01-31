<script lang="ts">
    /**
     * 추천 글 위젯
     * 자체 fetch 방식 (기존 패턴 유지)
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { RecommendedPosts } from '$lib/components/features/recommended';

    let { config, slot, isEditMode = false }: WidgetProps = $props();
</script>

<RecommendedPosts />
