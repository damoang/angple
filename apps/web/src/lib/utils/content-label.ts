/**
 * 삭제·빈 콘텐츠 표기 통일 (#13095, #13097)
 *
 * 같은 상태가 화면마다 다른 문구로 보이던 문제를 한 곳에서 판정한다.
 * 이전에는 목록 8종 / 댓글 목록 / 활동 패널 / 프로필 / 임시저장이 각자 문구를 갖고 있었고,
 * 텍스트 없는 댓글은 이모티콘·이미지·빈댓글 구분 없이 전부 "(내용 없음)" 으로 뭉개졌다.
 *
 * 표기 원칙 — 대괄호 [ ] = 상태 / 소괄호 ( ) = 내용의 종류
 *
 * ⚠️ 부모글이 삭제돼도 댓글은 살아있다(자진삭제 시 댓글 스레드 유지 정책 #12965).
 *    실측: free 30일 기준 2,925건. 이 경우 댓글 내용을 가리지 않고 배지로 맥락만 덧붙인다.
 */

/** 백엔드(mypage_handler.classifyContent)가 내려주는 콘텐츠 종류. */
export type ContentKind = 'text' | 'emoticon' | 'image' | 'video' | 'link' | 'empty';

export const LABEL_DELETED_POST = '[삭제된 게시물]';
export const LABEL_DELETED_COMMENT = '[삭제된 댓글]';
export const LABEL_NO_TITLE = '(제목 없음)';

const KIND_LABEL: Record<Exclude<ContentKind, 'text'>, string> = {
    emoticon: '(이모티콘)',
    image: '(이미지)',
    video: '(동영상)',
    link: '(링크)',
    empty: '(빈 댓글)'
};

export interface ContentLabel {
    /** 화면에 표시할 문구 */
    text: string;
    /** 회색 처리 여부 (삭제·빈 콘텐츠) */
    muted: boolean;
    /** 링크를 걸어도 되는지 — 삭제된 항목은 눌러도 갈 수 없다 */
    linkable: boolean;
    /** 부모글이 삭제된 댓글에 붙이는 맥락 배지 (댓글 자체는 살아있음) */
    badge?: string;
}

interface PostLike {
    deleted_at?: string | null;
    wr_subject?: string | null;
}

interface CommentLike {
    deleted_at?: string | null;
    post_deleted_at?: string | null;
    preview?: string | null;
    /** 백엔드 미배포 시 undefined — preview 기반으로 폴백한다 */
    content_kind?: ContentKind | null;
}

/** 점자공백(U+2800)은 빈댓글 기능이 쓰는 문자라 공백으로 취급한다. */
function isBlank(s: string | null | undefined): boolean {
    return !s || s.replace(/⠀/g, '').trim() === '';
}

/**
 * 글 제목 라벨.
 *
 * 삭제된 글은 제목을 노출하지 않는다 — soft delete 라 DB 에는 원문이 남지만,
 * 삭제한 사람의 의사를 존중해 화면에는 상태만 표시한다(#13097).
 */
export function getPostLabel(post: PostLike): ContentLabel {
    if (post.deleted_at) {
        return { text: LABEL_DELETED_POST, muted: true, linkable: false };
    }
    if (isBlank(post.wr_subject)) {
        return { text: LABEL_NO_TITLE, muted: true, linkable: true };
    }
    return { text: post.wr_subject as string, muted: false, linkable: true };
}

/**
 * 댓글 미리보기 라벨.
 *
 * 판정 순서(전수 실측 기반, 첫 매치 확정):
 *   댓글삭제 → 텍스트 있음 → content_kind → 빈 값(최종 폴백)
 * 마지막이 폴백이라 미분류가 남지 않는다.
 */
export function getCommentLabel(comment: CommentLike): ContentLabel {
    // 1. 댓글 자체가 삭제됨 — 내용 절대 노출 금지
    if (comment.deleted_at) {
        return { text: LABEL_DELETED_COMMENT, muted: true, linkable: false };
    }

    // 부모글만 삭제된 경우: 댓글은 살아있으므로 내용을 그대로 보여주고 배지만 붙인다
    const badge = comment.post_deleted_at ? LABEL_DELETED_POST : undefined;

    // 2. 텍스트가 남아 있으면 그대로
    if (!isBlank(comment.preview)) {
        return { text: comment.preview as string, muted: false, linkable: true, badge };
    }

    // 3. 백엔드가 알려준 종류로 표기 (미배포 시 undefined → 4번 폴백)
    const kind = comment.content_kind;
    if (kind && kind !== 'text' && kind in KIND_LABEL) {
        return {
            text: KIND_LABEL[kind as Exclude<ContentKind, 'text'>],
            muted: true,
            linkable: true,
            badge
        };
    }

    // 4. 최종 폴백 — 빈 댓글
    return { text: KIND_LABEL.empty, muted: true, linkable: true, badge };
}
