/**
 * 프로필 사진 즉시 반영 — 판정 로직만 담는 순수 함수
 *
 * 업로드·삭제에 성공하면 authStore 가 새 사진을 바로 그린다(setAvatar).
 * 그런데 직후의 invalidateAll·페이지 이동 SSR 이 다른 웹 파드에서 처리되면
 * 그 파드의 회원 캐시(L1, 60초)가 옛 사진을 내려줄 수 있다. 그 값으로 덮으면
 * 헤더가 옛 사진으로 되돌아간다. 그래서 업로드 직후 일정 시간 동안은
 * SSR 이 주는 사진 값을 무시하고 클라이언트가 아는 값을 유지한다(고정, pin).
 */

/** 고정 유지 시간. 회원 캐시 L1 수명(60초)보다 길게 잡는다. */
export const AVATAR_PIN_TTL_MS = 90_000;

export interface AvatarPin {
    /** 이 시각(ms) 전까지 SSR 의 사진 값을 무시한다 */
    until: number;
}

export function createAvatarPin(now: number, ttlMs: number = AVATAR_PIN_TTL_MS): AvatarPin {
    return { until: now + ttlMs };
}

/**
 * 업로드 응답의 URL(예: https://cdn.example/data/member_image/ab/x.webp)을
 * authStore·DB 가 쓰는 키 형태(data/member_image/ab/x.webp)로 바꾼다.
 * 이미 키 형태면 그대로, 비었으면 null.
 * (목록용 변형 경로 계산 `getAvatarUrl(..., size)` 은 키 형태만 알아본다)
 */
export function toMemberImageKey(url: string | null | undefined): string | null {
    const trimmed = url?.trim();
    if (!trimmed) return null;
    const absolute = trimmed.match(/^(?:https?:)?\/\/[^/]+(\/[^?#]*)?/i);
    const path = absolute ? absolute[1] || '' : trimmed.replace(/[?#].*$/, '');
    const key = path.replace(/^\/+/, '');
    return key || null;
}

export interface SsrAvatarDecision {
    /** SSR 값을 store 에 반영할지 */
    apply: boolean;
    /** 고정을 계속 유지할지(false 면 고정을 지운다) */
    keepPin: boolean;
}

/**
 * 같은 회원의 SSR 데이터가 왔을 때 사진 값을 반영할지 판정한다.
 * - 고정 중: SSR 값 무시(다른 파드의 옛 캐시일 수 있다)
 * - 고정 없음·만료: 기존 규칙 — SSR 값이 있고 지금과 다를 때만 반영
 *   (SSR 값이 비면 반영하지 않는다: 기존 동작 유지)
 */
export function resolveSsrAvatar(input: {
    current: string | null | undefined;
    ssr: string | null | undefined;
    pin: AvatarPin | null;
    now: number;
}): SsrAvatarDecision {
    const { current, ssr, pin, now } = input;
    if (pin && now < pin.until) {
        return { apply: false, keepPin: true };
    }
    return { apply: !!ssr && current !== ssr, keepPin: false };
}
