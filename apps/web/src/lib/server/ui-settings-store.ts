/**
 * 회원 UI 설정 서버 저장 (L2) — MySQL(진실 원본) + Redis(읽기 캐시)
 *
 * UI 개인화 설정(뮤트 키워드 등)은 그동안 localStorage(L1)에만 저장돼
 * Safari ITP(7일 미상호작용 삭제)·캐시삭제·기기 간 미동기로 "리셋"되는
 * 구조적 문제가 있었다(#12891). 이를 보완하기 위해 로그인 회원의 설정
 * 전체 JSON을 계정 단위로 MySQL에 영구 저장하고 Redis로 읽기 캐시한다.
 *
 * - 키: `uis:{mbId}` → settings JSON 문자열, TTL 300s. read-through.
 * - 진실 원본: g5_da_member_ui_settings(회원당 1행, ON DUPLICATE KEY upsert).
 * - 장애/미적용 시 graceful degrade: 모든 DB/Redis 접근을 try/catch로 감싸
 *   읽기는 null, 쓰기는 false 를 반환한다. 예외를 요청 핸들러로 전파하지 않아
 *   테이블 미생성·Redis 장애에도 앱은 L1(localStorage)로 계속 동작한다.
 */

import type { RowDataPacket } from 'mysql2';
import pool, { readPool } from '$lib/server/db';
import { getRedis } from '$lib/server/redis';

/** Redis 캐시 키 접두사 */
const CACHE_PREFIX = 'uis:';
/** Redis 캐시 TTL (초) */
const CACHE_TTL_SEC = 300;

interface UiSettingsRow extends RowDataPacket {
    settings: unknown;
}

function keyFor(mbId: string): string {
    return `${CACHE_PREFIX}${mbId}`;
}

/**
 * mysql2 JSON 컬럼은 드라이버 설정에 따라 객체 또는 문자열로 올 수 있어
 * 둘 다 안전하게 파싱한다. 파싱 불가/비객체면 null.
 */
function toObject(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : null;
        } catch {
            return null;
        }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return null;
}

/**
 * 회원 UI 설정 조회 (read-through: Redis → MySQL → Redis 캐시).
 * 서버에 저장된 값이 없으면 null. 장애 시에도 절대 throw 하지 않고 null 반환.
 */
export async function getMemberUiSettings(mbId: string): Promise<Record<string, unknown> | null> {
    if (!mbId) return null;
    try {
        const redis = getRedis();
        const cached = await redis.get(keyFor(mbId));
        if (cached) {
            const obj = toObject(cached);
            if (obj) return obj;
        }
    } catch {
        // Redis 장애 → DB로 폴백
    }

    try {
        const [rows] = await readPool.query<UiSettingsRow[]>(
            'SELECT settings FROM g5_da_member_ui_settings WHERE mb_id = ?',
            [mbId]
        );
        if (!rows || rows.length === 0) return null;
        const obj = toObject(rows[0].settings);
        if (!obj) return null;

        // best-effort 캐시 채우기 (실패해도 결과에는 영향 없음)
        try {
            await getRedis().setex(keyFor(mbId), CACHE_TTL_SEC, JSON.stringify(obj));
        } catch {
            // 캐시 실패 무시
        }
        return obj;
    } catch {
        // 테이블 미생성/DB 장애 → localStorage(L1) 폴백
        return null;
    }
}

/**
 * 회원 UI 설정 저장 (MySQL upsert + Redis 캐시 갱신).
 * 성공 시 true, 장애/실패 시 false. 절대 throw 하지 않음.
 */
export async function putMemberUiSettings(
    mbId: string,
    settings: Record<string, unknown>
): Promise<boolean> {
    if (!mbId) return false;
    const payload = JSON.stringify(settings);
    try {
        await pool.query(
            `INSERT INTO g5_da_member_ui_settings (mb_id, settings, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE settings = VALUES(settings), updated_at = NOW()`,
            [mbId, payload]
        );
    } catch {
        // 테이블 미생성/DB 장애 → 저장 실패(localStorage는 그대로 유지)
        return false;
    }

    // best-effort 캐시 갱신 (실패해도 저장 자체는 성공)
    try {
        await getRedis().setex(keyFor(mbId), CACHE_TTL_SEC, payload);
    } catch {
        // 캐시 실패 무시 — 다음 읽기에서 DB로 채워짐
    }
    return true;
}
