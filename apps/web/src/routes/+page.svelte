<script lang="ts">
    import { RecommendedPosts } from '$lib/components/features/recommended';
    import { NewBoard } from '$lib/components/features/new-board';
    import { EconomyTabs } from '$lib/components/features/economy';
    import { GalleryGrid } from '$lib/components/features/gallery';
    import { GroupTabs } from '$lib/components/features/group';
    import { AdSlot } from '$lib/components/ui/ad-slot';
</script>

<div class="space-y-4">
    <!-- index-head: 상단 광고 -->
    <AdSlot position="index-head" height="90px" />

    <!-- 추천 글 위젯 -->
    <RecommendedPosts />

    <!-- index-top: 추천글 하단 광고 -->
    <AdSlot position="index-top" height="90px" />

    <!-- 새로운 소식 & 알뜰구매 (2열 그리드) -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NewBoard />
        <EconomyTabs />
    </div>

    <!-- index-middle-1: 중간 광고 1 -->
    <AdSlot position="index-middle-1" height="90px" />

    <!-- 갤러리 -->
    <GalleryGrid />

    <!-- index-middle-2: 중간 광고 2 -->
    <AdSlot position="index-middle-2" height="90px" />

    <!-- 소모임 추천글 -->
    <GroupTabs />

    <!-- index-bottom: 하단 광고 -->
    <AdSlot position="index-bottom" height="90px" />
</div>
