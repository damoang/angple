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
let cached: { value: boolean; expiresAt: number } | null = null;

export async function isClientRecoveryEnabled(): Promise<boolean> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    let value = true;
    try {
        const [rows] = await readPool.query(
            `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
        );
        const raw = (rows as { settings_json: string | Record<string, unknown> | null }[])[0]?.settings_json;
        const parsed = !raw ? {} : typeof raw === 'string' ? JSON.parse(raw) : raw;
        const flag = (parsed as { client_recovery?: { enabled?: unknown } }).client_recovery?.enabled;
        if (flag === false || flag === 'false' || flag === 0) value = false;
    } catch {
        // 조회 실패는 켜짐 유지 — 실패값은 캐시하지 않는다
        return true;
    }
    cached = { value, expiresAt: now + TTL_MS };
    return value;
}

const PLACEHOLDER = '__ANGPLE_RECOVERY_ENABLED__';

/** app.html 인라인 핸들러의 플레이스홀더를 실제 값으로 치환 */
export function injectRecoveryFlag(html: string, enabled: boolean): string {
    return html.includes(PLACEHOLDER) ? html.replace(PLACEHOLDER, enabled ? 'true' : 'false') : html;
}
