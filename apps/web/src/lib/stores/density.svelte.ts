/**
 * UI 밀도 설정 스토어 (게시판 목록 + 댓글 공용)
 *
 * Cookie + localStorage 기반으로 사용자 선호 밀도를 저장합니다.
 * Cookie: SSR에서 읽어 --row-pad-extra / --comment-pad-extra CSS 변수를 <html>에 주입
 * localStorage: 기존 사용자 호환 (fallback)
 *
 * compact(촘촘) / balanced(보통) / relaxed(여유)
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_ui_density';
const COOKIE_KEY = 'angple_ui_density';

type Density = 'compact' | 'balanced' | 'relaxed';

function padValue(d: Density): string {
    return d === 'compact' ? '0px' : d === 'balanced' ? '3px' : '6px';
}

function createDensityStore() {
    let density = $state<Density>('balanced');

    if (browser) {
        try {
            // 1순위: 쿠키 (SSR과 동일한 소스)
            const cookieMatch = document.cookie.match(/angple_ui_density=(\w+)/);
            const fromCookie = cookieMatch ? cookieMatch[1] : null;
            // 2순위: localStorage (기존 사용자 호환)
            const fromLS = localStorage.getItem(STORAGE_KEY);
            const stored = (fromCookie || fromLS) as Density | null;
            if (stored === 'compact' || stored === 'balanced' || stored === 'relaxed') {
                density = stored;
            }
        } catch {
            // ignore
        }
    }

    return {
        get value() {
            return density;
        },
        set(d: Density) {
            density = d;
            if (browser) {
                try {
                    localStorage.setItem(STORAGE_KEY, d);
                } catch {
                    // ignore
                }
                // Cookie for SSR synchronization (1년 만료)
                if (d === 'balanced') {
                    document.cookie = `${COOKIE_KEY}=;path=/;max-age=0;SameSite=Lax`;
                } else {
                    document.cookie = `${COOKIE_KEY}=${d};path=/;max-age=31536000;SameSite=Lax`;
                }
                // <html> CSS 변수 즉시 업데이트
                const pad = padValue(d);
                document.documentElement.style.setProperty('--row-pad-extra', pad);
                document.documentElement.style.setProperty('--comment-pad-extra', pad);
            }
        },
        /** CSS 변수 값 (0px / 3px / 6px) */
        get padExtra() {
            return padValue(density);
        }
    };
}

export const densityStore = createDensityStore();
