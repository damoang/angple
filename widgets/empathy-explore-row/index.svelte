<script lang="ts">
    /**
     * 공감글 + 톺아보기 2컬럼 결합 위젯
     * PC(lg+): 나란히 배치, 모바일: 세로 스택
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { RecommendedPosts } from '$lib/components/features/recommended';
    import ExplorePreview from '$lib/components/features/explore/explore-preview.svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    const typedData = $derived(
        prefetchData as
            | {
                  recommended?: { data: unknown; period: unknown };
                  explore?: { data: unknown };
              }
            | undefined
    );
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <RecommendedPosts prefetchData={typedData?.recommended} />
    <ExplorePreview prefetchData={typedData?.explore} />
</div>
