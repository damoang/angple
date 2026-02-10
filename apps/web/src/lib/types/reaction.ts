/**
 * da_reaction 플러그인 호환 리액션 타입
 *
 * PHP da_reaction과 동일한 DB 구조 사용:
 * - g5_da_reaction (집계 카운트)
 * - g5_da_reaction_choose (개별 사용자 선택)
 *
 * 리액션 포맷: category:id (예: emoji:1f44d, angticon:emo-008)
 * 타겟 포맷: document:boardId:postId, comment:boardId:commentId
 */

/** 리액션 카테고리 */
export type ReactionRenderType = 'emoji' | 'image';

/** 카테고리 정의 */
export interface CategoryDef {
    category: string;
    title: string;
    renderType: ReactionRenderType;
    description?: string;
}

/** 이모티콘 정의 (피커용) */
export interface EmoticonDef {
    reaction: string; // category:id (예: emoji:1f44d, angticon:emo-008)
    category: string;
    renderType: ReactionRenderType;
    emoji?: string; // emoji 타입일 때 이모지 문자
    url?: string; // image 타입일 때 이미지 URL
}

/** 리액션 아이템 (API 응답) */
export interface ReactionItem {
    reaction: string; // category:id
    category: string;
    reactionId: string;
    count: number;
    choose: boolean; // 현재 사용자가 선택했는지
}

/** 특정 대상의 전체 리액션 정보 */
export interface ReactionData {
    [targetId: string]: ReactionItem[];
}

/** 리액션 대상 타입 */
export type ReactionTarget = 'post' | 'comment';

// ============================================================
// 헬퍼 함수
// ============================================================

/** 리액션 문자열 파싱 (category:id → { category, reactionId }) */
export function parseReaction(reaction: string): { category: string; reactionId: string } {
    const idx = reaction.indexOf(':');
    if (idx === -1) {
        return { category: 'emoji', reactionId: reaction };
    }
    return {
        category: reaction.substring(0, idx),
        reactionId: reaction.substring(idx + 1)
    };
}

/** 게시글 타겟 ID 생성 */
export function generateDocumentTargetId(boardId: string, postId: string | number): string {
    return `document:${boardId}:${postId}`;
}

/** 댓글 타겟 ID 생성 */
export function generateCommentTargetId(boardId: string, commentId: string | number): string {
    return `comment:${boardId}:${commentId}`;
}

/** 부모 ID 생성 (항상 document 타입) */
export function generateParentId(boardId: string, postId: string | number): string {
    return `document:${boardId}:${postId}`;
}

/** hex 코드를 이모지 문자로 변환 */
export function hexToEmoji(hex: string): string {
    try {
        return String.fromCodePoint(parseInt(hex, 16));
    } catch {
        return '';
    }
}

/** 리액션의 표시 정보를 동적으로 생성 */
export function getReactionDisplay(reaction: string): {
    renderType: ReactionRenderType;
    emoji?: string;
    url?: string;
    label: string;
} {
    const { category, reactionId } = parseReaction(reaction);

    switch (category) {
        case 'emoji':
            return {
                renderType: 'emoji',
                emoji: hexToEmoji(reactionId),
                label: hexToEmoji(reactionId)
            };
        case 'angticon':
            return {
                renderType: 'image',
                url: `/api/emoticons/nariya/damoang-${reactionId}.gif`,
                label: `앙티콘 ${reactionId}`
            };
        case 'noto-animoji':
            return {
                renderType: 'image',
                url: `https://fonts.gstatic.com/s/e/notoemoji/latest/${reactionId}/512.webp`,
                label: `Noto ${reactionId}`
            };
        case 'import-image':
            return {
                renderType: 'image',
                url: `/api/emoticons/da_reaction/${reactionId}.webp`,
                label: `이미지 ${reactionId}`
            };
        default:
            return { renderType: 'emoji', emoji: reaction, label: reaction };
    }
}
