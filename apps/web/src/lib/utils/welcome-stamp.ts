/**
 * hello 환영 라운지 — 원터치 환영 스탬프 판정 로직 (순수 함수).
 *
 * 스탬프 = welcome 팩 앙티콘 하나만 담긴 실제 댓글(`{emo:welcome-XXX.jpg}`).
 * "글당 1회" 는 클라이언트 판정만 한다 — 우회해도 일반 댓글과 동일 취급이라 서버 강제 불요.
 */

/** welcome(환영) 팩 파일명 prefix — /api/emoticons/list 의 pack.prefix 와 일치해야 한다 */
export const WELCOME_PACK_PREFIX = 'welcome';

/** 스탬프 댓글 판정용 단일 토큰 패턴: `{emo:welcome-….ext}` 하나만 */
const WELCOME_TOKEN_RE = /^\{emo:welcome-[^{}\s]+\}$/i;

/** 파일명 → 댓글 본문 토큰 (`transformEmoticons()` 가 렌더 시 이미지로 치환) */
export function welcomeStampContent(filename: string): string {
    return `{emo:${filename}}`;
}

/**
 * 댓글 본문이 "welcome 팩 앙티콘 단일 토큰"인지 판정.
 * 에디터 경유 저장분이 `<p>…</p>` 로 감싸일 수 있어 태그·공백(&nbsp; 포함)은 벗겨내고 비교한다.
 * 토큰 외 다른 텍스트가 섞여 있으면 스탬프가 아니라 일반 댓글로 본다.
 */
export function isWelcomeStampContent(content: string | null | undefined): boolean {
    if (!content) return false;
    const stripped = content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/[\u00a0\u2800]/g, ' ')
        .trim();
    return WELCOME_TOKEN_RE.test(stripped);
}

/** hasStampedWelcome 판정에 필요한 최소 댓글 형태 */
export interface WelcomeStampComment {
    author_id?: string;
    content?: string;
    deleted_at?: string | null;
}

/**
 * 내(myId)가 이 글에 환영 스탬프를 이미 남겼는지 — 삭제된 댓글은 제외(다시 환영 가능).
 */
export function hasStampedWelcome(
    comments: readonly WelcomeStampComment[] | null | undefined,
    myId: string | null | undefined
): boolean {
    if (!myId || !comments?.length) return false;
    return comments.some(
        (c) => c.author_id === myId && !c.deleted_at && isWelcomeStampContent(c.content)
    );
}
