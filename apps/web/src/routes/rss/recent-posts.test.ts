import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { buildRecentPostsSql, fetchRecentPosts, RECENT_POST_CANDIDATES } from './recent-posts';

/** 공백 차이를 무시하고 비교하기 위해 한 줄로 */
function flat(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
}

describe('buildRecentPostsSql', () => {
    const sql = flat(buildRecentPostsSql('free'));

    it('안쪽 후보 단계는 wr_id 역순으로 자른다', () => {
        expect(sql).toContain(
            `FROM g5_write_free WHERE wr_is_comment = 0 AND wr_deleted_at IS NULL ORDER BY wr_id DESC LIMIT ${RECENT_POST_CANDIDATES} ) recent`
        );
    });

    it('바깥은 날짜 최신순 + LIMIT 파라미터', () => {
        expect(sql).toMatch(/\) recent ORDER BY wr_datetime DESC LIMIT \?$/);
    });

    it('삭제 표시는 IS NULL 단독 — OR·0000 날짜 조건 없음', () => {
        expect(sql).not.toContain('0000');
        expect(sql).not.toMatch(/\bOR\b/);
    });

    it('본문(wr_content)을 읽지 않는다', () => {
        expect(sql).not.toContain('wr_content');
    });

    it('후보 수는 바깥 LIMIT(최대 20) 보다 넉넉하다', () => {
        expect(RECENT_POST_CANDIDATES).toBeGreaterThan(20);
    });

    it('잘못된 테이블명은 거부한다', () => {
        expect(() => buildRecentPostsSql('free; DROP TABLE x')).toThrow();
        expect(() => buildRecentPostsSql('free`')).toThrow();
        expect(() => buildRecentPostsSql('')).toThrow();
        expect(() => buildRecentPostsSql('a-b')).toThrow();
    });
});

describe('fetchRecentPosts', () => {
    it('바깥 LIMIT 을 바인딩 파라미터로 넘기고 행을 돌려준다', async () => {
        const rows = [{ wr_id: 2, wr_subject: 's', wr_name: 'n', wr_datetime: '2026-01-01' }];
        const query = vi.fn().mockResolvedValue([rows, []]);
        const db = { query } as unknown as Pick<Pool, 'query'>;

        const result = await fetchRecentPosts(db, 'economy', 5);

        expect(result).toEqual(rows);
        expect(query).toHaveBeenCalledTimes(1);
        const [sql, values] = query.mock.calls[0];
        expect(flat(sql)).toContain('FROM g5_write_economy');
        expect(values).toEqual([5]);
    });

    it('잘못된 테이블명이면 쿼리를 실행하지 않는다', async () => {
        const query = vi.fn();
        const db = { query } as unknown as Pick<Pool, 'query'>;

        await expect(fetchRecentPosts(db, 'bad name', 20)).rejects.toThrow();
        expect(query).not.toHaveBeenCalled();
    });
});
