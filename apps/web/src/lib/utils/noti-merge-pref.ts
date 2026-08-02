/**
 * 알림 묶어 보기(대상 단위 통합) 개인 설정.
 *
 * localStorage 기반 — 서버 스키마(g5_noti_preference)에 컬럼을 추가하려면 DDL 이 필요해
 * v1 은 기기별 설정으로 간다. 기본 켬: 안읽음이 3분의 1로 주는(30일 실측 3.1×) 수혜를
 * 기본 제공하고, 유형별로 따로 보고 싶은 회원만 끈다.
 */
import { browser } from '$app/environment';

const KEY = 'angple_noti_merge';
const AUTOREAD_KEY = 'angple_noti_autoread';

export function isNotiMergeEnabled(): boolean {
    if (!browser) return true;
    try {
        return localStorage.getItem(KEY) !== '0';
    } catch {
        return true;
    }
}

export function setNotiMergeEnabled(enabled: boolean): void {
    if (!browser) return;
    try {
        localStorage.setItem(KEY, enabled ? '1' : '0');
    } catch {
        // 저장 실패는 무시 — 설정이 안 남을 뿐 동작은 정상
    }
}

/**
 * 종을 열 때 자동으로 읽음 처리할지(#12991).
 *
 * 기본 켬 — "종을 한 번 눌러 확인했으면 숫자가 계속 뜨지 않았으면" 하는 요청(#12991)이
 * 먼저 있었다. 다만 그 반대를 원하는 분도 있어(bug/13206 "여러 개가 한 번에 읽음 처리된다")
 * 끌 수 있게 한다. 끄면 개별 알림을 클릭하거나 「모두 읽기」를 눌러야 읽음이 된다.
 */
export function isNotiAutoReadEnabled(): boolean {
    if (!browser) return true;
    try {
        return localStorage.getItem(AUTOREAD_KEY) !== '0';
    } catch {
        return true;
    }
}

export function setNotiAutoReadEnabled(enabled: boolean): void {
    if (!browser) return;
    try {
        localStorage.setItem(AUTOREAD_KEY, enabled ? '1' : '0');
    } catch {
        // 저장 실패는 무시
    }
}
