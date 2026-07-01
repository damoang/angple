/**
 * 회원 읽은 글 read-set (L2, Redis)
 *
 * localStorage(L1, stores/read-posts.svelte.ts)는 기기·브라우저 단위라
 * 메일 인앱브라우저·타기기 간 읽음이 넘어가지 않습니다. 이를 보완하기 위해
 * 로그인 회원의 읽은 글을 계정 단위 Redis 정렬셋에 기록하고, 목록 진입 시
 * 병합해 크로스기기로 일관되게 "읽음"을 표시합니다.
 *
 * - 키: `rp:{mbId}` 정렬셋. member = `{boardId}:{postId}`, score = ms timestamp.
 * - 쓰기: 글 조회 시(로그인) ZADD → 상한 초과분 오래된 것부터 제거 → TTL 갱신.
 * - 읽기: 최신순 최대 N개 반환(`{boardId}:{postId}` 문자열).
 * - Redis 장애 시 조용히 degrade(빈 배열 / no-op) — L1이 같은 기기는 커버.
 */

import { getRedis } from './redis';

/** 회원별 read-set 키 접두사 */
const READ_SET_PREFIX = 'rp:';
/** 회원당 최대 보관 개수 (localStorage 1000 이상으로 두어 병합 시 굶기지 않음) */
const MAX_READ_ENTRIES = 2000;
/** 비활성 회원 read-set 자동 정리 (180일, 쓰기마다 갱신) */
const READ_SET_TTL_SEC = 180 * 24 * 60 * 60;

function keyFor(mbId: string): string {
    return `${READ_SET_PREFIX}${mbId}`;
}

/**
 * 읽은 글 기록 (로그인 회원). 상한 초과 시 오래된 것부터 제거.
 * best-effort — 실패해도 예외를 전파하지 않음(조회 흐름 방해 금지).
 */
export async function addReadPost(mbId: string, boardId: string, postId: number): Promise<void> {
    if (!mbId || !boardId || !Number.isFinite(postId)) return;
    try {
        const redis = getRedis();
        const key = keyFor(mbId);
        const member = `${boardId}:${postId}`;
        const pipeline = redis.pipeline();
        pipeline.zadd(key, Date.now(), member);
        // 최신 MAX_READ_ENTRIES개만 유지: rank 0 ~ -(MAX+1) 범위(가장 오래된 것들) 제거
        pipeline.zremrangebyrank(key, 0, -(MAX_READ_ENTRIES + 1));
        pipeline.expire(key, READ_SET_TTL_SEC);
        await pipeline.exec();
    } catch {
        // Redis 장애 시 무시 — L1(localStorage)이 같은 기기는 커버
    }
}

/**
 * 회원의 읽은 글 목록(최신순, 최대 limit개) 반환.
 * @returns `{boardId}:{postId}` 형식 문자열 배열. 실패/미로그인 시 빈 배열.
 */
export async function getReadPosts(mbId: string, limit = MAX_READ_ENTRIES): Promise<string[]> {
    if (!mbId) return [];
    try {
        const redis = getRedis();
        const safeLimit = Math.max(1, Math.min(limit, MAX_READ_ENTRIES));
        // 최신순(score 내림차순) 상위 limit개
        return await redis.zrevrange(keyFor(mbId), 0, safeLimit - 1);
    } catch {
        return [];
    }
}
