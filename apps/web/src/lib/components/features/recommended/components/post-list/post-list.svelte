<script lang="ts">
    import type { RecommendedDataWithAI, RecommendedPost } from '$lib/api/types.js';
    import { PostCard } from '$lib/components/ui/post-card';

    let { data }: { data: RecommendedDataWithAI } = $props();

    // $derived 최적화: 섹션별로 포스트에 고유 키 부여 + 중복 제거
    const allPosts = $derived.by(() => {
        const seen = new Set<number>();
        const result: (RecommendedPost & { uniqueKey: string })[] = [];
        const sections = [
            { key: 'community', posts: data.sections.community.posts },
            { key: 'group', posts: data.sections.group.posts },
            { key: 'info', posts: data.sections.info.posts }
        ];
        for (const section of sections) {
            for (const post of section.posts ?? []) {
                if (seen.has(post.id)) continue;
                seen.add(post.id);
                result.push({ ...post, uniqueKey: `${section.key}-${post.id}` });
            }
        }
        return result;
    });
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
