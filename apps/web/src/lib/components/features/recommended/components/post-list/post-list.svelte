<script lang="ts">
    import type { RecommendedDataWithAI, RecommendedPost } from '$lib/api/types.js';
    import { PostCard } from '$lib/components/ui/post-card';

    let { data }: { data: RecommendedDataWithAI } = $props();

    // $derived 최적화: 섹션별로 포스트에 고유 키 부여
    const allPosts = $derived([
        ...(data.sections.community.posts ?? []).map((post, idx) => ({
            ...post,
            uniqueKey: `community-${idx}-${post.id}`
        })),
        ...(data.sections.group.posts ?? []).map((post, idx) => ({
            ...post,
            uniqueKey: `group-${idx}-${post.id}`
        })),
        ...(data.sections.info.posts ?? []).map((post, idx) => ({
            ...post,
            uniqueKey: `info-${idx}-${post.id}`
        }))
    ] as (RecommendedPost & { uniqueKey: string })[]);
</script>

{#if allPosts.length > 0}
    <!-- PHP 원본: row row-cols-1 row-cols-lg-2 (2컬럼 그리드) -->
    <ul class="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-x-4">
        {#each allPosts as post (post.uniqueKey)}
            <PostCard {post} />
        {/each}
    </ul>
{:else}
    <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-muted-foreground text-sm">아직 글이 없어요</p>
    </div>
{/if}
