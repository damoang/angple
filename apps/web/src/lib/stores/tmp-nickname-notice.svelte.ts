/**
 * 임시 닉네임 안내 상태 store (2026-09-08).
 *
 * 배경
 *   2026-07-10 부터 앱에서 소셜 로그인으로 가입하면 `tmp_<프로바이더>_<난수>` 형태의
 *   임시 닉네임이 붙은 채 로그인이 끝난다. 그 뒤 닉네임을 정하게 하는 단계가 없어서
 *   회원이 스스로 설정 화면을 찾아가지 않는 한 그대로 남는다.
 *   실측(2026-09-08): 193명이 임시 닉네임 상태, 스스로 바꾼 사람은 29명(13%).
 *
 * ⭐ 바꿀 수는 이미 있다 — 가입 시 `skipNickLock:true` 로 30일 쿨다운이 면제돼 있다.
 *    **알려주기만 하면 된다.** 그래서 이 안내는 막지 않고 알리기만 한다.
 *
 * ⛔ 닉네임을 대신 지어주지 않는다. 소셜 프로필의 displayName 은 naver·google·payco 에서
 *    **실명으로 폴백**한다(`oauth/providers/*.ts`). 자동 채움은 실명 공개가 된다.
 *
 * ⛔ 강제 모달로 만들지 않는다. 닫을 수 없는 창이 앱 안에서 뜨면 되돌릴 방법이 없다.
 *    읽기는 지금처럼 계속 되게 둔다.
 */

const DISMISS_KEY = 'damoang_tmp_nick_dismissed_until';
const DISMISS_DAYS = 7;

/** 임시 닉네임 접두사. 서버가 붙이는 값과 같아야 한다(`auth/register.ts`, 콜백 라우트). */
const TMP_PREFIX = 'tmp_';

function loadDismissedUntil(): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        return raw ? Number(raw) || 0 : 0;
    } catch {
        // 저장소가 막힌 환경(사생활 보호 모드 등) — 안내는 뜨되 기억만 못 한다.
        return 0;
    }
}

let dismissedUntil = $state(loadDismissedUntil());

/** 이 닉네임이 아직 임시값인가. ⛔ 빈 값·undefined 는 false 다(비로그인 포함). */
export function isTempNickname(nick: string | null | undefined): boolean {
    return typeof nick === 'string' && nick.startsWith(TMP_PREFIX);
}

export const tmpNicknameNotice = {
    /** 안내를 띄워도 되는 시점인가. 대상 판정(닉네임)은 컴포넌트가 함께 본다. */
    get notDismissed() {
        return Date.now() >= dismissedUntil;
    },
    dismiss(days: number = DISMISS_DAYS): void {
        const until = Date.now() + days * 24 * 60 * 60 * 1000;
        dismissedUntil = until;
        try {
            localStorage.setItem(DISMISS_KEY, String(until));
        } catch {
            // 저장소가 막힌 환경 — 이번 세션 동안만 유지된다.
        }
    }
};
