import { beforeEach, describe, expect, it } from 'vitest';
import {
    CHUNK_RETRY_DELAY_MS,
    __resetChunkRetryState,
    __trackedCount,
    shouldRetryChunk
} from './chunk-retry.js';

const CUR = 'https://damoang.net/free';
const T = (n: number) => `https://damoang.net/free/${n}`;

describe('shouldRetryChunk', () => {
    beforeEach(() => __resetChunkRetryState());

    it('처음 만난 URL 은 재시도한다', () => {
        expect(shouldRetryChunk(T(1), CUR)).toBe(true);
    });

    // ⛔ 무한 재시도는 사고다 — 같은 URL 은 한 번만
    it('같은 URL 두 번째는 재시도하지 않는다', () => {
        expect(shouldRetryChunk(T(1), CUR)).toBe(true);
        expect(shouldRetryChunk(T(1), CUR)).toBe(false);
        expect(shouldRetryChunk(T(1), CUR)).toBe(false);
    });

    it('다른 URL 은 각각 한 번씩 재시도한다', () => {
        expect(shouldRetryChunk(T(1), CUR)).toBe(true);
        expect(shouldRetryChunk(T(2), CUR)).toBe(true);
        expect(shouldRetryChunk(T(1), CUR)).toBe(false);
        expect(shouldRetryChunk(T(2), CUR)).toBe(false);
    });

    // ⛔ goto 가 no-op 이 되는 경우 — 초기 로드/재로드 중 실패
    it('목표가 현재 URL 과 같으면 재시도하지 않는다 (goto 가 no-op)', () => {
        expect(shouldRetryChunk(CUR, CUR)).toBe(false);
        expect(__trackedCount()).toBe(0);
    });

    it('빈 URL 은 재시도하지 않는다', () => {
        expect(shouldRetryChunk('', CUR)).toBe(false);
    });

    it('쿼리·해시가 다르면 다른 URL 로 본다', () => {
        expect(shouldRetryChunk(T(1) + '?p=2', CUR)).toBe(true);
        expect(shouldRetryChunk(T(1) + '?p=3', CUR)).toBe(true);
        expect(shouldRetryChunk(T(1) + '?p=2', CUR)).toBe(false);
    });

    // ⛔ 오래 켜둔 탭에서 무한 증식하지 않게
    it('상한(50)에 닿으면 비우고 다시 추적한다', () => {
        for (let i = 0; i < 50; i++) expect(shouldRetryChunk(T(i), CUR)).toBe(true);
        expect(__trackedCount()).toBe(50);
        // 51번째 진입 시 비워지고 그것만 남는다
        expect(shouldRetryChunk(T(999), CUR)).toBe(true);
        expect(__trackedCount()).toBe(1);
        // 비워졌으므로 예전 URL 이 다시 재시도 대상이 된다 — 의도된 동작(상한 대가)
        expect(shouldRetryChunk(T(0), CUR)).toBe(true);
    });

    it('상태를 비우면 같은 URL 이 다시 재시도된다', () => {
        expect(shouldRetryChunk(T(1), CUR)).toBe(true);
        expect(shouldRetryChunk(T(1), CUR)).toBe(false);
        __resetChunkRetryState();
        expect(shouldRetryChunk(T(1), CUR)).toBe(true);
    });

    it('재시도 지연은 0 보다 크다 (같은 순간 실패를 다시 만나지 않게)', () => {
        expect(CHUNK_RETRY_DELAY_MS).toBeGreaterThan(0);
        expect(CHUNK_RETRY_DELAY_MS).toBeLessThanOrEqual(2000);
    });
});
