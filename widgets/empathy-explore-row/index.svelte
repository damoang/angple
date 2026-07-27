<script lang="ts">
    /**
     * 공감글 + 모아보기 2컬럼 결합 위젯
     * PC(lg+): 나란히 배치, 모바일: 세로 스택
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { RecommendedData } from '$lib/api/types.js';
    import { RecommendedPosts } from '$lib/components/features/recommended';
    import ExplorePreview from '$lib/components/features/explore/explore-preview.svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    const typedData = $derived(
        prefetchData as
            | {
                  recommended?: { data: RecommendedData; period: unknown };
                  explore?: { data: unknown };
              }
            | undefined
    );

    // 공감글(왼쪽)에 이미 노출된 글 id 집합 → 모아보기(오른쪽)에서 제외.
    // 공감글 우선: 같은 글이 양쪽에 걸리면 공감글에만 남긴다(중복 노출 방지).
    // SSR prefetch 기준(초기 렌더=사용자가 실제로 보는 화면). 공감글 탭을 바꾸면
    // 집합은 그대로지만, 첫 화면 중복 제거가 목적이라 무해.
    const recommendedIds = $derived.by(() => {
        const sections = typedData?.recommended?.data?.sections;
        if (!sections) return undefined;
        const ids = new Set<number>();
        for (const section of Object.values(sections)) {
            for (const post of section?.posts ?? []) ids.add(post.id);
        }
        return ids;
    });
</script>

<!--
    grid 자동배치 → flex (#free-6824455 확장 주입 면역).
    번역 확장이 래퍼를 주입하면 grid 는 컬럼 배정이 통째로 밀리지만,
    flex+wrap 은 주입 노드가 다음 줄로 떨어질 뿐 두 컬럼 위치가 불변이다.
    gap-2(0.5rem) 절반 보정 = 0.25rem.
-->
<div class="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
    <div class="min-w-0 lg:w-[calc(50%-0.25rem)]">
        <RecommendedPosts prefetchData={typedData?.recommended} />
    </div>
    <div class="min-w-0 lg:w-[calc(50%-0.25rem)]">
        <ExplorePreview prefetchData={typedData?.explore} excludeIds={recommendedIds} />
    </div>
</div>
