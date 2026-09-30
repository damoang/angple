/**
 * 클라이언트 청크 복구(자동 새로고침) 킬스위치.
 *
 * 2026-09-28 무한 새로고침 사고 때 배포 없이 멈출 수단이 없어서 만들었다. 값이 false 면 app.html
 * 인라인 핸들러가 리로드하지 않고 텔레메트리만 남긴다. 기본(키 없음·조회 실패)은 **켜짐**(fail-open).
 *
 * 🔴 2026-09-30: **이 장치가 끌 수 없는 상태였다.** 원래 `site_settings` 한 곳만 봤는데
 *    그 테이블이 **0행**이어서, 문서가 안내한 `UPDATE ... WHERE site_id='default'` 가
 *    **0행 갱신으로 아무 일도 하지 않았다.** 행을 만들려면 INSERT 인데 같은 행의
 *    `active_theme`(컬럼 기본값 `damoang-official`)·`primary_color` 등이 권위를 갖게 되어
 *    **테마·브랜딩이 바뀔 위험**이 있었다(라이브 활성 테마는 `angple_settings.active_theme`).
 *    ⛔ 비상 장치는 만들 때 한 번 눌러봐야 한다. 두 달 가까이 안 듣는 상태로 있었다.
 *
 * 그래서 **행이 이미 있는 키-값 테이블 `angple_settings` 도 함께 본다.**
 *
 * ⭐ 판정: **둘 중 하나라도 false 면 끈다.** 킬스위치는 「끄는 쪽으로 확실」해야 하고,
 *    그러면 두 소스의 우선순위를 따질 필요도 없다.
 *
 * 끄기(권장 — 정상 설정 쓰기, 다른 값에 영향 없음):
 *   INSERT INTO angple_settings (setting_key, setting_value) VALUES ('client_recovery_enabled','false')
 *     ON DUPLICATE KEY UPDATE setting_value='false';
 * 다시 켜기: setting_value='true' (또는 행 삭제)
 * 확인: curl -s https://damoang.net/ | grep -o "var ENABLED = '[^']*'"   → 'false'
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
            // ⭐ 두 소스를 **각각** 본다. 하나가 없거나 깨져도 다른 하나로 끌 수 있어야 한다.
            const [kvRows, siteRows] = await Promise.all([
                readPool
                    .query(
                        `SELECT setting_value FROM angple_settings WHERE setting_key = 'client_recovery_enabled' LIMIT 1`
                    )
                    .catch(() => [[]] as unknown as [{ setting_value: string | null }[]]),
                readPool
                    .query(
                        `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
                    )
                    .catch(
                        () =>
                            [[]] as unknown as [
                                { settings_json: string | Record<string, unknown> | null }[]
                            ]
                    )
            ]);

            const isOff = (v: unknown) => v === false || v === 'false' || v === 0 || v === '0';

            // ① 키-값 테이블 (행이 이미 있는 곳 — 권장 경로)
            const kv = (kvRows as unknown as { setting_value: string | null }[][])[0]?.[0]
                ?.setting_value;
            const kvOff = kv !== undefined && kv !== null && isOff(String(kv).trim());

            // ② site_settings.settings_json (기존 경로 — 하위호환)
            const raw = (
                siteRows as unknown as {
                    settings_json: string | Record<string, unknown> | null;
                }[][]
            )[0]?.[0]?.settings_json;
            let siteOff = false;
            try {
                const parsed = !raw ? {} : typeof raw === 'string' ? JSON.parse(raw) : raw;
                siteOff = isOff(
                    (parsed as { client_recovery?: { enabled?: unknown } }).client_recovery?.enabled
                );
            } catch {
                siteOff = false; // JSON 이 깨져 있으면 「끔」으로 읽지 않는다
            }

            // ⭐ 둘 중 하나라도 false 면 끈다
            const value = !(kvOff || siteOff);
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
