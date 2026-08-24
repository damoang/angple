<script lang="ts">
    // 새글 피드(여러 게시판 합친 목록)를 게시판 리스트 레이아웃(classic)으로 렌더하는 공용 컴포넌트.
    // /feed(독립 페이지)와 /free?all=1(제자리 토글)이 함께 쓴다.
    // ⛔ authStore 로 렌더를 가르지 않는다(SSR null → 하이드레이션 미스매치). classic 도 authStore 무관.
    import Classic from '$lib/components/features/board/layouts/list/classic.svelte';
    import type { FreePost } from '$lib/api/types.js';

    interface FeedRow {
        bn_id: number;
        wr_id: number;
        wr_parent: number;
        wr_subject: string;
        wr_content: string;
        wr_name: string;
        mb_id: string;
        wr_hit: number;
        wr_comment: number;
        bn_datetime: string;
        bo_table: string;
        bo_subject: string;
    }

    let { items = [], showBoardName = true }: { items?: FeedRow[]; showBoardName?: boolean } =
        $props();

    // 댓글행인지(피드엔 새 댓글도 섞임). wr_id != wr_parent 이면 댓글.
    function isComment(item: { wr_id: number; wr_parent: number }): boolean {
        return item.wr_id !== item.wr_parent;
    }

    // 피드행(NewPostItem)을 classic 이 받는 FreePost 형태로 변환. 피드에 없는 값(좋아요·아바타·
    // 카테고리·썸네일)은 비움 → classic 이 우아하게 degrade. key 는 호출부가 bn_id 로 준다.
    function mapFeedRowToPost(item: FeedRow): FreePost {
        const comment = isComment(item);
        return {
            id: item.wr_id,
            title: comment ? item.wr_content || item.wr_subject : item.wr_subject,
            content: '',
            author: item.wr_name,
            author_id: item.mb_id,
            views: item.wr_hit,
            likes: 0,
            comments_count: comment ? 0 : item.wr_comment,
            created_at: item.bn_datetime,
            board_id: item.bo_table
        };
    }
</script>

<div class="divide-border divide-y">
    {#each items as item (item.bn_id)}
        <Classic
            post={mapFeedRowToPost(item)}
            href={isComment(item)
                ? `/${item.bo_table}/${item.wr_parent}#c_${item.wr_id}`
                : `/${item.bo_table}/${item.wr_id}`}
            {showBoardName}
            boardName={item.bo_subject}
        />
    {/each}
</div>
