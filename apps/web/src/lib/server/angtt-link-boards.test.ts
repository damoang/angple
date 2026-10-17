import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, execute, readQuery } = vi.hoisted(() => ({
    query: vi.fn(),
    execute: vi.fn(),
    readQuery: vi.fn()
}));
vi.mock('$lib/server/db', () => ({
    default: { query, execute },
    readPool: { query: readQuery }
}));

const work = {
    id: 1,
    slug: 'work-1',
    canonical_title: '테스트작품',
    aliases: [],
    poster_url: null,
    meta: { auto_link: true, context_terms: ['후기'] },
    type: 'movie',
    external_ids: { tmdb: 123 }
};

/** 게시판별 확장 설정(features.angttLink) */
let boardModes: Record<string, string> = {};
/** 글 행 */
let post: { wr_subject: string; wr_option: string } | null = null;
/** 글 태그 */
let tags: string[] = [];

function route(sql: string): unknown {
    if (sql.includes('FROM angple_entities')) return [[work]];
    if (sql.includes('FROM angple_entity_posts ep')) return [[{ total: 0, removed: 0 }]];
    if (sql.includes('SELECT tag FROM g5_na_tag_log')) return [tags.map((tag) => ({ tag }))];
    if (sql.includes('SELECT wr_subject, wr_option')) return [post ? [post] : []];
    if (sql.includes('SELECT id FROM g5_na_tag')) return [[{ id: 9 }]];
    throw new Error(`unexpected query: ${sql}`);
}

function linkInserts(): unknown[][] {
    return execute.mock.calls.filter(([sql]) => String(sql).includes('angple_entity_posts'));
}

beforeEach(() => {
    vi.resetModules();
    query.mockReset();
    execute.mockReset();
    readQuery.mockReset();
    boardModes = {};
    post = { wr_subject: '테스트작품 후기', wr_option: 'html1' };
    tags = [];
    query.mockImplementation(async (sql: string) => route(sql));
    execute.mockResolvedValue([{ affectedRows: 1, insertId: 9 }]);
    readQuery.mockImplementation(async (_sql: string, params: unknown[]) => {
        const mode = boardModes[String(params[0])];
        return [mode ? [{ settings: { features: { angttLink: mode } } }] : []];
    });
});

describe('autoLinkAngttEntity — 제목 자동 연결', () => {
    it('auto 게시판은 free 와 같이 제목으로 연결한다(role=auto)', async () => {
        boardModes.movie = 'auto';
        const { autoLinkAngttEntity } = await import('./angtt-auto-link');
        expect(await autoLinkAngttEntity('movie', 10)).toBe('work-1');
        const inserts = linkInserts();
        expect(inserts).toHaveLength(1);
        expect(String(inserts[0][0])).toContain('INSERT IGNORE');
        expect(inserts[0][1]).toEqual([1, 'movie', 10, 'auto']);
    });

    it('free 는 설정 없이도 연결한다', async () => {
        const { autoLinkAngttEntity } = await import('./angtt-auto-link');
        expect(await autoLinkAngttEntity('free', 10)).toBe('work-1');
        expect(readQuery).not.toHaveBeenCalled();
    });

    it('suggest 게시판은 제목만 보고 연결하지 않는다', async () => {
        boardModes.qa = 'suggest';
        const { autoLinkAngttEntity } = await import('./angtt-auto-link');
        expect(await autoLinkAngttEntity('qa', 10)).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('설정이 없는 게시판(off)은 아무것도 하지 않는다', async () => {
        const { autoLinkAngttEntity } = await import('./angtt-auto-link');
        expect(await autoLinkAngttEntity('hello', 10)).toBeNull();
        expect(query).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
    });

    it('비밀글은 연결하지 않는다', async () => {
        boardModes.movie = 'auto';
        post = { wr_subject: '테스트작품 후기', wr_option: 'html1,secret' };
        const { autoLinkAngttEntity } = await import('./angtt-auto-link');
        expect(await autoLinkAngttEntity('movie', 10)).toBeNull();
        expect(await autoLinkAngttEntity('free', 11)).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });
});

describe('linkEntityFromTags — 작성자가 단 태그로 연결', () => {
    beforeEach(() => {
        tags = ['앙티티', 'work-1'];
    });

    it('suggest 게시판은 태그 연결을 받는다(role=mention)', async () => {
        boardModes.qa = 'suggest';
        const { linkEntityFromTags } = await import('./angtt-auto-link');
        expect(await linkEntityFromTags('qa', 20)).toBe('work-1');
        expect(linkInserts()[0][1]).toEqual([1, 'qa', 20, 'mention']);
    });

    it('off 게시판은 태그가 있어도 연결하지 않는다', async () => {
        const { linkEntityFromTags } = await import('./angtt-auto-link');
        expect(await linkEntityFromTags('hello', 20)).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('비밀글은 태그가 있어도 연결하지 않는다', async () => {
        boardModes.qa = 'suggest';
        post = { wr_subject: '질문', wr_option: 'secret' };
        const { linkEntityFromTags } = await import('./angtt-auto-link');
        expect(await linkEntityFromTags('qa', 20)).toBeNull();
        expect(await linkEntityFromTags('free', 21)).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('review 는 angtt 게시판에서만 — 다른 게시판 설정으로는 생기지 않는다', async () => {
        boardModes.movie = 'auto';
        const { linkEntityFromTags } = await import('./angtt-auto-link');
        await linkEntityFromTags('angtt', 30);
        await linkEntityFromTags('movie', 31);
        const [angtt, movie] = linkInserts();
        expect(String(angtt[0])).toContain("'review'");
        expect(angtt[1]).toEqual([1, 'angtt', 30]);
        expect(String(movie[0])).not.toContain("'review'");
        expect(movie[1]).toEqual([1, 'movie', 31, 'mention']);
    });

    it('설정에 review 를 넣어도 받아들이지 않는다(off 로 본다)', async () => {
        boardModes.movie = 'review';
        const { linkEntityFromTags } = await import('./angtt-auto-link');
        expect(await linkEntityFromTags('movie', 32)).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });
});

describe('detectEntityForBoard — 작성폼 제안 칩', () => {
    it('auto 는 자동 연결 안내까지, suggest 는 제안만, off 는 감지하지 않는다', async () => {
        const { detectEntityForBoard } = await import('./angtt-auto-link');
        expect(await detectEntityForBoard('auto', '테스트작품 후기', [])).toMatchObject({
            slug: 'work-1',
            canAutoLink: true
        });
        expect(await detectEntityForBoard('suggest', '테스트작품 후기', [])).toMatchObject({
            slug: 'work-1',
            canAutoLink: false
        });
        expect(await detectEntityForBoard('off', '테스트작품 후기', [])).toBeNull();
    });

    it('suggest 게시판도 작품 링크(TMDB)는 감지한다', async () => {
        const { detectEntityForBoard } = await import('./angtt-auto-link');
        expect(
            await detectEntityForBoard('suggest', '', ['https://www.themoviedb.org/movie/123'])
        ).toMatchObject({ slug: 'work-1', canAutoLink: false });
    });
});
