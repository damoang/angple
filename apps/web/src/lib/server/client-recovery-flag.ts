/**
 * 클라이언트 청크 복구(자동 새로고침) 킬스위치 — site_settings.settings_json.client_recovery.enabled
 *
 * 2026-09-28 무한 새로고침 사고 때 배포 없이 멈출 수단이 없었다. 값이 false 면 app.html 인라인 핸들러가
 * 리로드하지 않고 텔레메트리만 남긴다. 기본(키 없음·조회 실패)은 **켜짐**.
 * 끄기: UPDATE site_settings SET settings_json = JSON_SET(settings_json, '$.client_recovery.enabled', false) WHERE site_id = 'default';
 * 60초 모듈 캐시라 끄면 최대 1분(+SSR 캐시 TTL) 뒤 전 페이지 반영.
 */
import { readPool } from '$lib/server/db.js';

const TTL_MS = 60_000;
const FAIL_TTL_MS = 10_000; // 조회 실패도 잠깐 캐시 — SSR 캐시 미스 전 요청이 지나는 핫패스라 DB 장애 때 매 요청 쿼리를 막는다
let cached: { value: boolean; expiresAt: number } | null = null;
let inflight: Promise<boolean> | null = null; // 만료 순간 동시 요청이 전부 DB 를 치지 않게(singleflight)

export async function isClientRecoveryEnabled(): Promise<boolean> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const [rows] = await readPool.query(
                `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
            );
            const raw = (rows as { settings_json: string | Record<string, unknown> | null }[])[0]
                ?.settings_json;
            const parsed = !raw ? {} : typeof raw === 'string' ? JSON.parse(raw) : raw;
            const flag = (parsed as { client_recovery?: { enabled?: unknown } }).client_recovery
                ?.enabled;
            const value = !(flag === false || flag === 'false' || flag === 0);
            cached = { value, expiresAt: Date.now() + TTL_MS };
            return value;
        } catch {
            // 조회 실패는 켜짐 유지, 10초만 캐시
            cached = { value: true, expiresAt: Date.now() + FAIL_TTL_MS };
            return true;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

const PLACEHOLDER = '__ANGPLE_RECOVERY_ENABLED__';

/** app.html 인라인 핸들러의 플레이스홀더를 실제 값으로 치환 */
export function injectRecoveryFlag(html: string, enabled: boolean): string {
    return html.includes(PLACEHOLDER)
        ? html.replace(PLACEHOLDER, enabled ? 'true' : 'false')
        : html;
}
