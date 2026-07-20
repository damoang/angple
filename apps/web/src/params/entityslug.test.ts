import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { match, RESERVED } from './entityslug';

describe('entityslug 매처 — /angtt/[slug] 가 다른 라우트를 섀도잉하지 않아야 한다', () => {
    it('작품 slug 는 매칭된다', () => {
        expect(match('호프')).toBe(true);
        expect(match('동궁')).toBe(true);
        expect(match('movie-1987')).toBe(true);
    });

    it('숫자 ID 는 매칭되지 않는다 (angtt 게시판 글 URL 보호)', () => {
        expect(match('7297')).toBe(false);
        expect(match('13')).toBe(false);
    });

    // 2026-07-20 실장애: /angtt/write 가 작품 페이지로 잡혀 글쓰기가 404 였다.
    it('⛔ [boardId] 아래 정적 라우트 이름은 매칭되지 않는다 — 글쓰기 404 방지', () => {
        expect(match('write')).toBe(false);
        expect(match('WRITE')).toBe(false);
    });

    it('빈 문자열은 매칭되지 않는다', () => {
        expect(match('')).toBe(false);
    });
});

/**
 * 사람 기억에 의존하지 않는 방어.
 *
 * RESERVED 는 블랙리스트라 [boardId] 아래에 정적 디렉터리가 새로 생기면
 * 누군가 기억해서 갱신해야 하고, 빠뜨리면 2026-07-20 과 같은 404 장애가 재발한다.
 * 여기서 **실제 라우트 디렉터리를 읽어** RESERVED 와 대조하므로, 갱신을 빠뜨리면 CI 가 먼저 실패한다.
 */
describe('RESERVED 목록이 실제 라우트 구조와 일치하는가', () => {
    it('[boardId] 아래 정적 하위 라우트가 모두 RESERVED 에 있다', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const boardIdDir = resolve(here, '../routes/[boardId]');

        const staticDirs = readdirSync(boardIdDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            // 동적 세그먼트([postId] 등)와 라우트가 아닌 디렉터리(_로 시작)는 충돌 대상이 아니다
            .map((e) => e.name)
            .filter((n) => !n.startsWith('[') && !n.startsWith('_'));

        const missing = staticDirs.filter((n) => !RESERVED.has(n.toLowerCase()));

        expect(
            missing,
            `[boardId] 아래 정적 라우트가 RESERVED 에 없습니다: ${missing.join(', ')}\n` +
                `→ apps/web/src/params/entityslug.ts 의 RESERVED 에 추가하세요. ` +
                `그러지 않으면 /angtt/${missing[0] ?? 'X'} 가 작품 페이지로 잡혀 404 가 됩니다.`
        ).toEqual([]);
    });
});
