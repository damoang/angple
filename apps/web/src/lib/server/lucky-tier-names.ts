/**
 * 럭키 배지 회차명(설정 이름·평소 단계 이름) — 웹 댓글 직접 조회 경로용.
 *
 * 백엔드 배지 조회는 lucky_config 의 windows·fixed_windows 이름과 base_name(평소 단계 이름)을
 * 허용 목록으로 쓴다. 웹 댓글 API 는 DB 를 직접 읽으므로 같은 값이 필요하다. 매 요청 조회하지 않도록
 * 30초 모듈 캐시(백엔드 lucky_config 캐시 TTL 과 같은 값) + singleflight 로 한 번에 읽는다.
 *
 * 조회 실패·행 없음·JSON 깨짐이면 설정 이름은 빈 목록, base_name 은 기본 「앙팡」 —
 * 기본 3개와 「앙팡」만 인정한다. 배지 라벨이 없어질 뿐 금액 표시에는 영향이 없다.
 */
import { readPool } from '$lib/server/db.js';
import {
    LUCKY_DEFAULT_BASE_NAME,
    luckyBaseNameFromConfig,
    luckyTierNamesFromConfig
} from '$lib/utils/lucky-badge';

const TTL_MS = 30_000;
const FAIL_TTL_MS = 10_000;

/** 회차명 판정에 쓰는 설정 값. */
export interface LuckyTierInfo {
    /** windows·fixed_windows 이름(중복 없음) */
    names: string[];
    /** 평소 단계 이름. 설정이 없으면 「앙팡」 */
    baseName: string;
}

function defaultTierInfo(): LuckyTierInfo {
    return { names: [], baseName: LUCKY_DEFAULT_BASE_NAME };
}

let cached: { value: LuckyTierInfo; expiresAt: number } | null = null;
let inflight: Promise<LuckyTierInfo> | null = null;

/** settings_json(문자열 또는 객체)에서 lucky_config 의 이름 목록과 base_name 을 뽑는다. */
export function tierInfoFromSettingsJson(raw: unknown): LuckyTierInfo {
    if (!raw) return defaultTierInfo();
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return defaultTierInfo();
        const cfg = (parsed as { lucky_config?: unknown }).lucky_config;
        return { names: luckyTierNamesFromConfig(cfg), baseName: luckyBaseNameFromConfig(cfg) };
    } catch {
        return defaultTierInfo();
    }
}

/** settings_json 에서 설정 이름 목록만. */
export function tierNamesFromSettingsJson(raw: unknown): string[] {
    return tierInfoFromSettingsJson(raw).names;
}

/** 설정 이름 목록과 base_name 을 캐시에서(없으면 쿼리 1회로) 읽는다. */
export async function getLuckyTierInfo(): Promise<LuckyTierInfo> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const [rows] = await readPool.query(
                `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
            );
            const raw = (rows as { settings_json: unknown }[])[0]?.settings_json;
            const value = tierInfoFromSettingsJson(raw);
            cached = { value, expiresAt: Date.now() + TTL_MS };
            return value;
        } catch {
            const value = defaultTierInfo();
            cached = { value, expiresAt: Date.now() + FAIL_TTL_MS };
            return value;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** 설정 이름 목록만(같은 캐시). */
export async function getLuckyTierNames(): Promise<string[]> {
    return (await getLuckyTierInfo()).names;
}

/** 테스트용: 캐시를 비운다. */
export function resetLuckyTierNamesCache(): void {
    cached = null;
    inflight = null;
}
