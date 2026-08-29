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
/**
 * `import-image:` 리액션의 실제 확장자 표.
 *
 * ⭐ 이 집합은 **닫혀 있다.** `REACTION_REPLACE` 를 비운 뒤로 새 `import-image` 는
 *    생기지 않고, 이모티콘 피커도 이 종류를 제공하지 않는다. 그래서 표가 정본이다.
 * ⛔ 소비 코드가 `.webp` 를 하드코딩해 왔는데 실제로는 gif 40 · webp 9 · jpg 8 이다.
 *    (2026-08-29 `g5_da_reaction` 76개 × legacy-data 전수 대조)
 */
const IMPORT_IMAGE_EXT: Record<string, string> = {
    'damoang-air-001': 'webp',
    'damoang-air-003': 'gif',
    'damoang-air-004': 'gif',
    'damoang-air-005': 'webp',
    'damoang-air-006': 'gif',
    'damoang-air-010': 'gif',
    'damoang-air-011': 'gif',
    'damoang-emo-000': 'gif',
    'damoang-emo-004': 'gif',
    'damoang-emo-005': 'gif',
    'damoang-emo-006': 'gif',
    'damoang-emo-007': 'gif',
    'damoang-emo-008': 'gif',
    'damoang-emo-011': 'gif',
    'damoang-emo-012': 'gif',
    'damoang-emo-014': 'gif',
    'damoang-emo-015': 'gif',
    'damoang-emo-016': 'gif',
    'damoang-emo-017': 'gif',
    'damoang-emo-023': 'gif',
    'damoang-emo-025': 'gif',
    'damoang-emo-026': 'gif',
    'damoang-emo-028': 'gif',
    'damoang-emo-029': 'gif',
    'damoang-emo-030': 'gif',
    'damoang-emo-031': 'gif',
    'damoang-emo-033': 'webp',
    'damoang-emo-036': 'webp',
    'damoang-emo-037': 'webp',
    'damoang-emo-038': 'gif',
    'damoang-emo-040': 'gif',
    'damoang-emo-041': 'gif',
    'damoang-emo-042': 'gif',
    'damoang-emo-043': 'gif',
    'damoang-meme-002': 'gif',
    'damoang-meme-007': 'webp',
    'damoang-meme-016': 'webp',
    'damoang-meme-023': 'webp',
    'damoang-meme-030': 'gif',
    'damoang-meme-037': 'gif',
    'damoang-meme-63': 'webp',
    'damoang-meme-69': 'jpg',
    'logo-muzia': 'jpg',
    'moon-emo-016': 'gif',
    'onion-001': 'gif',
    'onion-006': 'gif',
    'onion-038': 'gif',
    'onion-113': 'gif',
    'onion-161': 'gif',
    'onion-254': 'gif',
    'onion-269': 'gif',
    'president-003': 'jpg',
    'president-006': 'jpg',
    'welcome-001': 'jpg',
    'welcome-002': 'jpg',
    'welcome-003': 'jpg',
    'welcome-004': 'jpg'
};

/**
 * 원본이 서버에 남아 있지 않은 19개용 중립 아이콘.
 *
 * ⛔ 리액션 행을 지우면 반응 수가 줄어 이상해지므로 남긴다. 네트워크를 타지 않는
 *    data URI 라 404 가 나지 않는다(`img-src 'self' data: blob: https:` 로 CSP 통과 확인).
 */
export const BROKEN_REACTION_ICON =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">' +
            '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".45"/>' +
            '<path d="M7 8.2a3 3 0 0 1 5.6 1.3c0 2-2.6 2.2-2.6 3.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>' +
            '<circle cx="10" cy="15.4" r=".9" fill="currentColor" opacity=".45"/>' +
            '</svg>'
    );

export function getReactionDisplay(reaction: string): {
    renderType: ReactionRenderType;
    emoji?: string;
    url?: string;
    /**
     * 정지 대체본. 모션 최소화(`prefers-reduced-motion: reduce`) 사용자와
     * 피커 그리드(44개 동시 로드)가 쓴다. 앙티콘에만 있다.
     */
    staticUrl?: string;
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
            // **움직이는** 파생본을 쓴다(`_anim.webp`, 장변 최대 160px·프레임 최대 30).
            //
            // ⛔ 정지 `_thumb.webp` 로 되돌리지 마라. 2026-08-17 에 용량을 이유로 정지본으로
            //    바꿨다가 "박수가 손뼉을 안 친다" 는 제보를 받고 되돌린 자리다. 당시 근거였던
            //    "20px 에서 애니메이션 인지가 거의 없다" 는 **측정하지 않은 단정이었고 틀렸다.**
            //    하필 emo-014(박수)가 전체에서 가장 많이 쓰이는 반응이었다.
            // ⭐ 용량 걱정은 실측으로 해소됐다. 리액션바는 글에 실제로 달린 반응만 그리고
            //    그 수는 평균 1.28개다(44개를 한 번에 받는 것은 피커다). 사용빈도 가중으로
            //    글 1개당 21.8KB(원본 GIF) → 13.9KB(_anim) 로 **되레 줄었다**.
            //
            // ⛔ 여기가 **실제로 화면에 그려지는 경로**다. reaction-config.ts 의 ANGTICONS 는
            //    피커에 "고를 수 있는 목록"을 만들 뿐, 이미 달린 리액션은 이 함수를 탄다.
            //    2026-08-17 에 config 만 고치고 이 줄을 놓쳐서 번들에 .gif 가 남았었다.
            //    앙티콘 URL 을 바꿀 때는 **두 곳을 같이** 바꿔야 한다.
            // ⛔ 파생본이 없는 앙티콘은 404 로 깨진다. scripts/make-reaction-anim.py 로
            //    _anim.webp 를 먼저 만들고 호스트에 동기화한 뒤 바꿀 것(파일 먼저·코드 나중).
            return {
                renderType: 'image',
                url: `/api/emoticons/nariya/damoang-${reactionId}_anim.webp`,
                staticUrl: `/api/emoticons/nariya/damoang-${reactionId}_thumb.webp`,
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
        case 'import-image': {
            const ext = IMPORT_IMAGE_EXT[reactionId];
            return {
                renderType: 'image',
                // ⛔ da_reaction 경로를 쓰면 안 된다. 그 요청은 호스트 nginx 규칙에 없어
                //    파드의 SvelteKit 라우트로 가는데, 파드에는 `/home/damoang/legacy-data`
                //    가 마운트돼 있지 않아 **항상 404** 다(2026-08-29 파드 안에서 실측).
                //    nariya 는 호스트 nginx 가 alias 로 직접 서빙해 200 이다 — 같은 파일이다.
                url: ext ? `/api/emoticons/nariya/${reactionId}.${ext}` : BROKEN_REACTION_ICON,
                label: `이미지 ${reactionId}`
            };
        }
        default:
            return { renderType: 'emoji', emoji: reaction, label: reaction };
    }
}
