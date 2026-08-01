/**
 * 알림 묶어 보기(대상 단위 통합) 개인 설정.
 *
 * localStorage 기반 — 서버 스키마(g5_noti_preference)에 컬럼을 추가하려면 DDL 이 필요해
 * v1 은 기기별 설정으로 간다. 기본 켬: 안읽음이 3분의 1로 주는(30일 실측 3.1×) 수혜를
 * 기본 제공하고, 유형별로 따로 보고 싶은 회원만 끈다.
 */
import { browser } from '$app/environment';

const KEY = 'angple_noti_merge';

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
