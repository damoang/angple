/**
 * 서버사이드 세션 스토어
 *
 * Lucia v3 패턴 참고: crypto-random 세션 ID + SHA-256 해시 DB 저장
 * - 세션 ID: 32 bytes hex (브라우저 쿠키)
 * - DB에는 SHA-256 해시만 저장 (DB 유출 시 세션 탈취 불가)
 * - CSRF 토큰 포함 (Double-submit cookie 패턴)
 */
import { randomBytes, createHash } from 'crypto';
import pool from '$lib/server/db.js';
import { TieredCache } from '$lib/server/cache.js';
import { getRedis } from '$lib/server/redis.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { LAST_ACTIVE_UPDATE_INTERVAL_MS, acquireTouchSlot } from './session-touch.js';

/** 세션 수명: 30일 */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** 슬라이딩 윈도우: 마지막 활동 후 15일 이내에 재접속하면 갱신 */
const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * last_active_at 업데이트 간격: 1시간 (파드 간 Redis 스로틀 공유 — session-touch.ts).
 *
 * last_active_at 을 읽는 곳은 아래 getSession() 의 15일 슬라이딩 판정뿐이다
 * (그 밖에는 운영 점검용 「최근 14일 활동」 집계 정도로, 시간 단위 정밀도가 필요 없다).
 * 활동 중인 세션의 last_active_at 은 최대 약 2시간(캐시 미스 시 표식 초기화 + 간격) 늦을 수 있는데,
 * 15일(=360시간) 판정에서 이 오차는 「15일 직전에 돌아온 사용자」의 갱신 시점을
 * 최대 2시간 앞당기거나 미루는 정도라 만료·로그아웃 동작은 바뀌지 않는다.
 * expires_at 연장(슬라이딩)과 만료 삭제는 스로틀 없이 그대로 수행한다.
 */
const LAST_ACTIVE_UPDATE_INTERVAL = LAST_ACTIVE_UPDATE_INTERVAL_MS;

export interface SessionData {
    sessionId: string; // 원본 세션 ID (쿠키에 저장, DB에는 해시만)
    mbId: string;
    csrfToken: string;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
    /** 마지막 last_active_at DB UPDATE 시각 (epoch ms). sessionCache lifecycle 와 묶여 자동 cleanup. */
    lastDbUpdate?: number;
}

interface SessionRow extends RowDataPacket {
    id: number;
    session_id_hash: string;
    mb_id: string;
    csrf_token: string;
    ip: string | null;
    user_agent: string | null;
    created_at: Date;
    last_active_at: Date;
    expires_at: Date;
}

// --- 2-tier 세션 캐시: L1(Map) → L2(Redis) ---
// 2026-04-26: maxL1 10000 → 2000 (pod 메모리 -30~100 MB).
// L1 miss 시 Redis L2 fallback 정상 동작 (실 동시세션 < 5000).
//
// 2026-04-27: lastDbUpdate 를 SessionData entry 안으로 merge (PR #1303).
// 기존 별도 unbounded Map(lastDbUpdateMap) 이 12h+ 누수 source 였음 — 익명/크롤러 트래픽이
// 영원히 누적. 이제 sessionCache 의 LRU evict 시 자동 cleanup.
const sessionCache = new TieredCache<SessionData>('sess', 60_000, 300, 2000);

/** 세션 ID 생성 (32 bytes → 64 hex chars) */
function generateSessionId(): string {
    return randomBytes(32).toString('hex');
}

/** CSRF 토큰 생성 (32 bytes → 64 hex chars) */
function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

/** SHA-256 해시 */
function hashSessionId(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex');
}

/**
 * 새 세션 생성
 * @returns 세션 ID (쿠키에 저장할 원본 값) + CSRF 토큰
 */
export async function createSession(
    mbId: string,
    metadata?: { ip?: string; userAgent?: string }
): Promise<{ sessionId: string; csrfToken: string; expiresAt: Date }> {
    const sessionId = generateSessionId();
    const sessionIdHash = hashSessionId(sessionId);
    const csrfToken = generateCsrfToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

    await pool.query<ResultSetHeader>(
        `INSERT INTO angple_sessions (session_id_hash, mb_id, csrf_token, ip, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            sessionIdHash,
            mbId,
            csrfToken,
            metadata?.ip ?? null,
            metadata?.userAgent?.substring(0, 512) ?? null,
            expiresAt
        ]
    );

    return { sessionId, csrfToken, expiresAt };
}

/**
 * last_active_at 터치 (fire-and-forget, 요청을 막거나 실패시키지 않음).
 * 간격 안에서 다른 파드가 이미 갱신했으면 생략한다. Redis 장애면 파드별 판정대로 갱신한다.
 */
function touchLastActive(sessionIdHash: string): void {
    void (async () => {
        let redis: ReturnType<typeof getRedis> | null = null;
        try {
            redis = getRedis();
        } catch {
            // Redis 클라이언트 생성 실패 → 파드별 판정으로 폴백
        }
        const slot = redis ? await acquireTouchSlot(redis, sessionIdHash) : 'error';
        if (slot === 'taken') return;
        await pool.query<ResultSetHeader>(
            `UPDATE angple_sessions SET last_active_at = NOW() WHERE session_id_hash = ?`,
            [sessionIdHash]
        );
    })().catch(() => {});
}

/**
 * 세션 조회 (유효성 검증 포함, 2-tier 캐시)
 * - L1(Map) 히트: 0ms
 * - L2(Redis) 히트: 1-3ms
 * - 미스: DB SELECT + 조건부 UPDATE
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
    const sessionIdHash = hashSessionId(sessionId);
    const now = Date.now();

    // 1. 2-tier 캐시 확인 (L1 → L2)
    const cached = await sessionCache.get(sessionIdHash);
    if (cached) {
        // last_active_at 비동기 업데이트 (1시간 간격, fire-and-forget)
        // L1 entry mutate — sessionCache evict 시 자연 cleanup. L2(Redis) 는 다음 miss 후 fresh set.
        // 파드별 표식으로 1차 거르고, 파드 간 중복은 Redis 스로틀로 거른다.
        const lastUpdate = cached.lastDbUpdate ?? 0;
        if (now - lastUpdate > LAST_ACTIVE_UPDATE_INTERVAL) {
            cached.lastDbUpdate = now;
            touchLastActive(sessionIdHash);
        }
        return cached;
    }

    // 2. DB 조회 (캐시 미스)
    const [rows] = await pool.query<SessionRow[]>(
        `SELECT mb_id, csrf_token, ip, user_agent, created_at, last_active_at, expires_at
         FROM angple_sessions
         WHERE session_id_hash = ?
         LIMIT 1`,
        [sessionIdHash]
    );

    if (rows.length === 0) {
        await sessionCache.delete(sessionIdHash);
        return null;
    }

    const row = rows[0];
    const nowDate = new Date();

    // 만료 확인
    if (nowDate > new Date(row.expires_at)) {
        await sessionCache.delete(sessionIdHash);
        pool.query<ResultSetHeader>(`DELETE FROM angple_sessions WHERE session_id_hash = ?`, [
            sessionIdHash
        ]).catch(() => {});
        return null;
    }

    // 슬라이딩 윈도우
    const lastActive = new Date(row.last_active_at);
    if (nowDate.getTime() - lastActive.getTime() > SESSION_REFRESH_THRESHOLD_MS) {
        const newExpiresAt = new Date(nowDate.getTime() + SESSION_MAX_AGE_MS);
        pool.query<ResultSetHeader>(
            `UPDATE angple_sessions SET last_active_at = NOW(), expires_at = ? WHERE session_id_hash = ?`,
            [newExpiresAt, sessionIdHash]
        ).catch(() => {});
    } else if (nowDate.getTime() - lastActive.getTime() > LAST_ACTIVE_UPDATE_INTERVAL) {
        touchLastActive(sessionIdHash);
    }

    const sessionData: SessionData = {
        sessionId,
        mbId: row.mb_id,
        csrfToken: row.csrf_token,
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: new Date(row.created_at),
        lastActiveAt: new Date(row.last_active_at),
        expiresAt: new Date(row.expires_at),
        lastDbUpdate: now
    };

    // 3. 2-tier 캐시에 저장 (L1 + L2)
    await sessionCache.set(sessionIdHash, sessionData);

    return sessionData;
}

/**
 * 세션 파괴 (로그아웃) — L1 + L2 캐시 무효화
 */
export async function destroySession(sessionId: string): Promise<void> {
    const sessionIdHash = hashSessionId(sessionId);
    await sessionCache.delete(sessionIdHash);
    await pool.query<ResultSetHeader>(`DELETE FROM angple_sessions WHERE session_id_hash = ?`, [
        sessionIdHash
    ]);
}

/**
 * 사용자의 모든 세션 파괴 ("모든 기기에서 로그아웃").
 *
 * ⚠️ **현재 live 호출처가 없다 — 그래도 지우지 말 것.**
 *    유일한 호출처는 purge-auth-artifacts.ts 이고, 그건 다시 member-leave.ts 의
 *    processMemberLeave()(PHP 호환, 현재 dead) 에서만 불린다.
 *    실서비스 탈퇴의 세션 파기는 백엔드가 단독으로 맡는다
 *    (backend/internal/handler/auth_artifacts.go).
 *    ⛔ "호출처가 없으니 죽은 코드"라고 판단해 삭제하거나, 반대로 "죽은 코드에
 *       기능을 붙였다"고 오판하지 말 것 — 2026-08-12 이 사안의 1차 구현이 정확히
 *       그 혼동으로 실패했다(파기를 dead path 에만 붙여 실제 탈퇴에 안 걸림).
 *    "모든 기기에서 로그아웃" UI 를 새로 만들면 이 함수가 그 자리에서 되살아난다.
 *
 * ⛔ **L1 만 비우면 소용이 없다.** TieredCache.get() 은 L1 미스 시 L2(Redis)에서 읽어
 *    L1 을 다시 채운다. 그래서 예전 구현(clearL1() 만 호출)은 삭제한 세션이 다음 요청
 *    한 번에 되살아나 **L2 TTL(300초) 동안 인증이 유지**됐다.
 *    검증에서 실측으로 확인된 결함이다.
 *    → DELETE 하기 전에 대상 해시를 읽어 **키 단위로 L1+L2 를 모두 지운다.**
 */
export async function destroyAllUserSessions(mbId: string): Promise<number> {
    // DELETE 전에 캐시 키를 확보해야 한다 — 지운 뒤에는 어떤 해시였는지 알 수 없다.
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT session_id_hash FROM angple_sessions WHERE mb_id = ?`,
        [mbId]
    );
    await Promise.allSettled(rows.map((r) => sessionCache.delete(String(r.session_id_hash))));

    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM angple_sessions WHERE mb_id = ?`,
        [mbId]
    );
    return result.affectedRows;
}

/**
 * 만료된 세션 정리 (주기적 호출)
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM angple_sessions WHERE expires_at < NOW()`
    );
    return result.affectedRows;
}

/** 세션 쿠키 설정 상수 */
export const SESSION_COOKIE_NAME = 'angple_sid';
export const CSRF_COOKIE_NAME = 'angple_csrf';
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30일 (초 단위)
