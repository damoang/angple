<script lang="ts">
    /**
     * 공감글 + 모아보기 2컬럼 결합 위젯
     * PC(lg+): 나란히 배치, 모바일: 세로 스택
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { EmpathyPosts } from '$lib/components/features/empathy';
    import DiscoverPreview from '$lib/components/features/discover/discover-preview.svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    const typedData = $derived(
        prefetchData as
            | {
                  empathy?: { data: unknown; period: unknown };
                  discover?: { data: unknown };
              }
            | undefined
    );
</script>

<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
    <EmpathyPosts prefetchData={typedData?.empathy} />
    <DiscoverPreview prefetchData={typedData?.discover} />
</div>
