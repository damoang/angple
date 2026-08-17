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
            // 정지 썸네일을 쓴다. 리액션바는 20×20(h-5 w-5)으로 그리는데 원본 GIF 는
            // 최대 152,924B 이고 같은 파일의 _thumb.webp 는 1,142B 다(134배).
            //
            // ⛔ 여기가 **실제로 화면에 그려지는 경로**다. reaction-config.ts 의 ANGTICONS 는
            //    피커에 "고를 수 있는 목록"을 만들 뿐, 이미 달린 리액션은 이 함수를 탄다.
            //    2026-08-17 에 config 만 고치고 이 줄을 놓쳐서 번들에 .gif 가 남았었다.
            //    앙티콘 URL 을 바꿀 때는 **두 곳을 같이** 바꿔야 한다.
            // ⛔ 썸네일이 없는 앙티콘은 404 로 깨진다. scripts/make-reaction-thumbs.py 로
            //    _thumb.webp 를 먼저 만들고 호스트에 동기화한 뒤 바꿀 것(파일 먼저·코드 나중).
            return {
                renderType: 'image',
                url: `/api/emoticons/nariya/damoang-${reactionId}_thumb.webp`,
                label: `앙티콘 ${reactionId}`
            };
        case 'noto-animoji': {
            // Noto 애니메이션 CDN 경로는 복합 코드포인트를 '_' 로 잇는다(예: 2764_fe0f).
            // 저장 형식은 '-' 를 쓰므로(2764-fe0f) '_' 로 변환해야 한다. 단일 코드포인트
            // (1f44d 등)는 하이픈이 없어 영향 없음. 미변환 시 하트가 404(액박)로 표시됨.
            const notoPath = reactionId.replace(/-/g, '_');
            return {
                renderType: 'image',
                url: `https://fonts.gstatic.com/s/e/notoemoji/latest/${notoPath}/512.webp`,
                label: `Noto ${reactionId}`
            };
        }
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
