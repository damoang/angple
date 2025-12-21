<script lang="ts">
    import { RecommendedPosts } from '$lib/components/features/recommended';
    import { NewBoard } from '$lib/components/features/new-board';
    import { EconomyTabs } from '$lib/components/features/economy';
    import { GalleryGrid } from '$lib/components/features/gallery';
    import { GroupTabs } from '$lib/components/features/group';
</script>

<div class="space-y-4">
    <!-- 추천 글 위젯 -->
    <RecommendedPosts />

    <!-- 새로운 소식 & 알뜰구매 (2열 그리드) -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NewBoard />
        <EconomyTabs />
    </div>

    <!-- 갤러리 -->
    <GalleryGrid />

    <!-- 소모임 추천글 -->
    <GroupTabs />
</div>
