/**
 * 글에 투표가 달려 있는지 (상세 SSR → 투표 위젯 힌트)
 *
 * 투표는 극소수 글에만 달리는데 위젯은 모든 글 상세에서 by-post 를 불렀다.
 * 로더가 이 값을 실어 보내고, false + 비작성자면 위젯이 호출을 생략한다.
 *
 * ⛔ 반환값은 3상태다. 조회 실패·잘못된 인자는 반드시 null(=모름) — false(=없음)로
 *    떨어뜨리면 투표가 있는 글에서도 위젯이 사라진다(fail-open 이 깨짐).
 * 비로그인 상세는 엣지 캐시(s-maxage=60, swr=120)라 이 값도 본문과 수명이 같다(최대 180초).
 *    생성만 늦게 보이고, 삭제 방향(true 잔존)은 위젯이 조회해 exists:false 를 받으므로 무해.
 */
import { readPool } from '$lib/server/db.js';
import { createCache } from '$lib/server/cache.js';
import type { RowDataPacket } from 'mysql2';

// 본문 SSR 을 막는 1단계 묶음에서 기다리는 값이라 짧게 끊는다. 늦으면 null(모름)로
// 두면 위젯이 기존처럼 호출하므로(fail-open) 풀 포화 때 본문을 늦출 이유가 없다.
export const HAS_POLL_TIMEOUT_MS = 300;

/**
 * 투표가 달린 글 전체 집합(프로세스 캐시). 투표 행은 적고 생성만 있어(삭제 없음)
 * 글마다 조회하는 대신 집합 하나를 짧게 들고 있는다. 새 투표는 최대 TTL 늦게 true 가 된다
 * (위 엣지 캐시 지연과 같은 방향 — 생성만 늦게 보인다). 조회 실패는 캐시하지 않는다.
 */
export const POLL_SET_TTL_MS = 60_000;

let pollSetCache = createCache<Set<string>>({ ttl: POLL_SET_TTL_MS, maxSize: 1 });
const POLL_SET_KEY = 'all';

// bo_table 비교는 DB 정렬 규칙처럼 대소문자를 가리지 않게 맞춘다.
function pollKey(boTable: string, wrId: number): string {
    return `${boTable.toLowerCase()}:${wrId}`;
}

// 집합 로드가 끝나지 않으면 singleflight 가 계속 그 약속을 돌려주므로 따로 끊는다(오류 → 미캐시).
export const POLL_SET_LOAD_TIMEOUT_MS = 5_000;

async function loadPollSet(): Promise<Set<string>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const query = readPool
        .query<RowDataPacket[]>('SELECT bo_table, wr_id FROM angple_polls')
        .then(([rows]) => {
            const set = new Set<string>();
            for (const row of rows) {
                set.add(pollKey(String(row.bo_table), Number(row.wr_id)));
            }
            return set;
        });
    query.catch(() => {});
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error('poll set load timeout')),
            POLL_SET_LOAD_TIMEOUT_MS
        );
    });
    try {
        return await Promise.race([query, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchHasPoll(boTable: string, wrId: number): Promise<boolean | null> {
    if (!boTable || !Number.isInteger(wrId) || wrId <= 0) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const query = pollSetCache
            .getOrSet(POLL_SET_KEY, loadPollSet)
            .then((set) => set.has(pollKey(boTable, wrId)));
        const timeout = new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), HAS_POLL_TIMEOUT_MS);
        });
        // 진 쪽 쿼리가 나중에 실패해도 unhandled rejection 이 되지 않게
        query.catch(() => {});
        return await Promise.race([query, timeout]);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** 테스트용: 집합 캐시(진행 중 로드 포함)를 새로 만든다. */
export function clearPollSetCacheForTest(): void {
    pollSetCache = createCache<Set<string>>({ ttl: POLL_SET_TTL_MS, maxSize: 1 });
}
