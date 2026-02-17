<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import Coins from '@lucide/svelte/icons/coins';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { FreePost } from '$lib/api/types.js';
    import { parseQAInfo, getQAStatusLabel, getQAStatusColor } from '$lib/types/qa-board.js';

    interface Props {
        post: FreePost;
        boardId: string;
    }

    let { post, boardId }: Props = $props();

    const qa = $derived(parseQAInfo(post));
    const isAuthor = $derived(
        authStore.user?.mb_id === post.author_id || authStore.user?.mb_name === post.author
    );

    let isAccepting = $state(false);

    /** 답변 채택 */
    async function acceptAnswer(commentId: number): Promise<void> {
        if (!isAuthor || isAccepting) return;
        isAccepting = true;

        try {
            await apiClient.updatePost(boardId, String(post.id), {
                extra_1: 'solved',
                extra_3: String(commentId)
            });
            // 페이지 새로고침으로 상태 반영
            window.location.reload();
        } catch (err) {
            console.error('답변 채택 실패:', err);
        } finally {
            isAccepting = false;
        }
    }
</script>

<!-- Q&A 상태 헤더 -->
<Card class="mb-4">
    <CardContent class="flex items-center justify-between py-3">
        <div class="flex items-center gap-3">
            <Badge class={getQAStatusColor(qa.status)}>
                {getQAStatusLabel(qa.status)}
            </Badge>
            {#if qa.bounty > 0}
                <Badge variant="outline" class="gap-1">
                    <Coins class="h-3 w-3" />
                    현상금 {qa.bounty}P
                </Badge>
            {/if}
        </div>
        {#if isAuthor && qa.status !== 'solved' && qa.status !== 'closed'}
            <p class="text-muted-foreground text-sm">댓글에서 "답변 채택" 버튼을 눌러 채택하세요</p>
        {/if}
        {#if qa.acceptedAnswerId}
            <div class="flex items-center gap-1 text-green-600">
                <CircleCheck class="h-4 w-4" />
                <span class="text-sm font-medium">채택된 답변 있음</span>
            </div>
        {/if}
    </CardContent>
</Card>
