/**
 * 럭키 배지 회차명(설정 이름) 목록 — 웹 댓글 직접 조회 경로용.
 *
 * 백엔드 배지 조회는 lucky_config 의 windows·fixed_windows 이름을 허용 목록으로 쓴다.
 * 웹 댓글 API 는 DB 를 직접 읽으므로 같은 목록이 필요하다. 매 요청 조회하지 않도록
 * 30초 모듈 캐시(백엔드 lucky_config 캐시 TTL 과 같은 값) + singleflight 로 읽는다.
 *
 * 조회 실패·행 없음·JSON 깨짐이면 빈 목록 — 기본 3개(앙복타임 등)만 인정한다.
 * 배지 라벨이 없어질 뿐 금액 표시에는 영향이 없다.
 */
import { readPool } from '$lib/server/db.js';
import { luckyTierNamesFromConfig } from '$lib/utils/lucky-badge';

const TTL_MS = 30_000;
const FAIL_TTL_MS = 10_000;

let cached: { value: string[]; expiresAt: number } | null = null;
let inflight: Promise<string[]> | null = null;

/** settings_json(문자열 또는 객체)에서 lucky_config 의 이름 목록을 뽑는다. */
export function tierNamesFromSettingsJson(raw: unknown): string[] {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return [];
        return luckyTierNamesFromConfig((parsed as { lucky_config?: unknown }).lucky_config);
    } catch {
        return [];
    }
}

export async function getLuckyTierNames(): Promise<string[]> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const [rows] = await readPool.query(
                `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
            );
            const raw = (rows as { settings_json: unknown }[])[0]?.settings_json;
            const value = tierNamesFromSettingsJson(raw);
            cached = { value, expiresAt: Date.now() + TTL_MS };
            return value;
        } catch {
            cached = { value: [], expiresAt: Date.now() + FAIL_TTL_MS };
            return [];
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** 테스트용: 캐시를 비운다. */
export function resetLuckyTierNamesCache(): void {
    cached = null;
    inflight = null;
}
