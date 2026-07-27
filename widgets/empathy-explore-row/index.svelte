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
    grid 는 확장이 요소를 주입하면 컬럼 배정이 통째로 밀려 좌우가 뒤바뀌거나
    한쪽이 다음 행으로 내려간다. flex 는 각 카드가 자기 폭을 유지한 채
    넘친 것만 다음 줄로 떨어진다.

    ⛔ w-[calc(50%-…)] 를 쓰지 않는다. 합이 정확히 100% 라 컨테이너 폭이
    홀수 서브픽셀일 때 조기 wrap(카드 하나가 통째로 아래로) 위험이 있다.
    flex-1 basis-0 은 1fr 과 수학적으로 동일 배분이면서 그 위험이 없다.
    ⛔ *:h-full 필수 — grid 시절 두 카드는 stretch 로 바닥선이 맞았다.
    래퍼를 씌우면 늘어나는 건 래퍼뿐이라 이게 없으면 짧은 카드 바닥이 올라온다.
-->
<div class="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
    <div class="min-w-0 *:h-full lg:min-w-0 lg:flex-1 lg:basis-0">
        <RecommendedPosts prefetchData={typedData?.recommended} />
    </div>
    <div class="min-w-0 *:h-full lg:min-w-0 lg:flex-1 lg:basis-0">
        <ExplorePreview prefetchData={typedData?.explore} excludeIds={recommendedIds} />
    </div>
</div>
