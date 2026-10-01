import { describe, expect, it } from 'vitest';
import {
    ALL_DAY_END,
    ALL_DAY_START,
    buildBoardLuckyBody,
    buildPutConfigBody,
    clientBoardErrors,
    clientFieldErrors,
    diffValues,
    emptyFixedWindow,
    emptyPrize,
    emptyWindow,
    fieldErrorMap,
    fixedWindowNotes,
    formatDiffValue,
    isValidClock,
    kstToday,
    removedTierNames,
    type LuckyAdminConfig
} from './angpang-admin';

// 시험용 값. 운영값과 무관한 임의의 숫자다.
function sampleConfig(): LuckyAdminConfig {
    return {
        enabled: false,
        include_comments: false,
        member_daily_cap: 3,
        daily_cap: 7,
        daily_cap_post: 7,
        daily_cap_comment: 8,
        min_comment_chars: 4,
        expire_days: 30,
        window_start_hour: 1,
        window_end_hour: 5,
        windows: [
            {
                name: '단계A',
                minutes: 11,
                odds: 13,
                comment_odds: 0,
                points: 17,
                prizes: [{ weight: 1, points: 2, exp: 0 }]
            }
        ],
        fixed_windows: [
            {
                name: '고정A',
                start: '01:00',
                end: '02:00',
                odds: 19,
                comment_odds: 23,
                points: 0,
                prizes: []
            }
        ]
    };
}

describe('buildPutConfigBody (PUT 본문 = config 만)', () => {
    it('GET 응답 전체가 섞여 들어와도 config 키만 남긴다', () => {
        const view = {
            ...sampleConfig(),
            config: sampleConfig(),
            boards: [],
            history: [],
            cache_ttl_seconds: 30,
            stored_parse_error: false,
            stored_raw: '{}'
        } as unknown as LuckyAdminConfig;
        const body = buildPutConfigBody(view);
        expect(Object.keys(body).sort()).toEqual(
            [
                'enabled',
                'include_comments',
                'member_daily_cap',
                'daily_cap',
                'daily_cap_post',
                'daily_cap_comment',
                'min_comment_chars',
                'expire_days',
                'window_start_hour',
                'window_end_hour',
                'windows',
                'fixed_windows'
            ].sort()
        );
        expect(body).toEqual(sampleConfig());
    });

    it('단계·상품 줄의 화면 전용 키도 버린다', () => {
        const cfg = sampleConfig();
        (cfg.windows[0] as unknown as Record<string, unknown>).uiKey = 1;
        (cfg.windows[0].prizes[0] as unknown as Record<string, unknown>).id = 'x';
        const body = buildPutConfigBody(cfg);
        expect(Object.keys(body.windows[0]).sort()).toEqual(
            ['comment_odds', 'minutes', 'name', 'odds', 'points', 'prizes'].sort()
        );
        expect(body.windows[0].prizes[0]).toEqual({ weight: 1, points: 2, exp: 0 });
    });

    it('원본과 분리된 복사본이다', () => {
        const cfg = sampleConfig();
        const body = buildPutConfigBody(cfg);
        body.windows[0].prizes[0].weight = 99;
        body.fixed_windows.push(emptyFixedWindow());
        expect(cfg.windows[0].prizes[0].weight).toBe(1);
        expect(cfg.fixed_windows).toHaveLength(1);
    });

    it('목록이 없으면 빈 배열로 보낸다', () => {
        const cfg = { ...sampleConfig(), windows: undefined, fixed_windows: null };
        const body = buildPutConfigBody(cfg as unknown as LuckyAdminConfig);
        expect(body.windows).toEqual([]);
        expect(body.fixed_windows).toEqual([]);
    });

    it('JSON 문자열에 응답 전용 키가 없다', () => {
        const json = JSON.stringify(buildPutConfigBody(sampleConfig()));
        expect(json).not.toContain('history');
        expect(json).not.toContain('boards');
        expect(json).not.toContain('"config"');
    });
});

describe('buildBoardLuckyBody', () => {
    it('알려진 키만', () => {
        const lucky = {
            enabled: true,
            points: 1,
            odds: 2,
            comment_odds: 3,
            prizes: [{ weight: 1, points: 1, exp: 1 }],
            extra: 1
        };
        expect(buildBoardLuckyBody(lucky)).toEqual({
            enabled: true,
            points: 1,
            odds: 2,
            comment_odds: 3,
            prizes: [{ weight: 1, points: 1, exp: 1 }]
        });
    });
});

describe('diffValues (변경 미리보기)', () => {
    it('같으면 빈 목록', () => {
        expect(diffValues(sampleConfig(), sampleConfig())).toEqual([]);
    });

    it('바뀐 필드만 before→after', () => {
        const after = sampleConfig();
        after.enabled = true;
        after.fixed_windows[0].end = '03:00';
        expect(diffValues(sampleConfig(), after)).toEqual([
            { path: 'enabled', before: false, after: true },
            { path: 'fixed_windows[0].end', before: '02:00', after: '03:00' }
        ]);
    });

    it('줄 추가는 (없음)→값', () => {
        const after = sampleConfig();
        after.windows[0].prizes.push({ weight: 5, points: 6, exp: 7 });
        expect(diffValues(sampleConfig(), after)).toEqual([
            { path: 'windows[0].prizes[1].weight', before: undefined, after: 5 },
            { path: 'windows[0].prizes[1].points', before: undefined, after: 6 },
            { path: 'windows[0].prizes[1].exp', before: undefined, after: 7 }
        ]);
    });

    it('줄 삭제는 값→(없음), 빈 목록이 되면 목록 자체도', () => {
        const after = sampleConfig();
        after.fixed_windows = [];
        const d = diffValues(sampleConfig(), after);
        expect(d).toContainEqual({
            path: 'fixed_windows[0].name',
            before: '고정A',
            after: undefined
        });
        expect(d).toContainEqual({ path: 'fixed_windows', before: undefined, after: [] });
        expect(d.find((e) => e.path === 'fixed_windows[0].prizes')).toEqual({
            path: 'fixed_windows[0].prizes',
            before: [],
            after: undefined
        });
    });

    it('빈 목록끼리는 같다', () => {
        expect(diffValues({ a: [] }, { a: [] })).toEqual([]);
    });

    it('표시 문자열', () => {
        expect(formatDiffValue(undefined)).toBe('(없음)');
        expect(formatDiffValue(true)).toBe('켬');
        expect(formatDiffValue(false)).toBe('끔');
        expect(formatDiffValue('')).toBe('""');
        expect(formatDiffValue(0)).toBe('0');
        expect(formatDiffValue([])).toBe('[]');
    });
});

describe('removedTierNames (배지 라벨 사라짐 경고)', () => {
    it('이름을 바꾸거나 지우면 그 이름', () => {
        const after = sampleConfig();
        after.fixed_windows[0].name = '고정B';
        expect(removedTierNames(sampleConfig(), after)).toEqual(['고정A']);
        after.windows = [];
        expect(removedTierNames(sampleConfig(), after)).toEqual(['단계A', '고정A']);
    });

    it('그대로거나 추가만 하면 없음', () => {
        const after = sampleConfig();
        after.fixed_windows.push({ ...emptyFixedWindow(), name: '고정C' });
        expect(removedTierNames(sampleConfig(), after)).toEqual([]);
    });

    it('기본 이름은 설정에서 빠져도 라벨이 남으므로 제외', () => {
        const before = sampleConfig();
        before.windows[0].name = '앙팡타임';
        const after = sampleConfig();
        after.windows = [];
        expect(removedTierNames(before, after)).toEqual([]);
    });
});

describe('fieldErrorMap / clientFieldErrors', () => {
    it('경로별로 모은다', () => {
        expect(
            fieldErrorMap([
                { field: 'a', message: '1' },
                { field: 'a', message: '2' },
                { field: '', message: '3' }
            ])
        ).toEqual({ a: ['1', '2'], '': ['3'] });
    });

    it('정상 설정은 오류 없음', () => {
        expect(clientFieldErrors(sampleConfig())).toEqual([]);
    });

    it('빈칸(null)·소수·음수·시각 형식·빈 이름을 백엔드와 같은 경로로', () => {
        const cfg = sampleConfig();
        (cfg as unknown as Record<string, unknown>).daily_cap_post = null;
        cfg.expire_days = 1.5;
        cfg.windows[0].prizes[0].exp = -1;
        cfg.fixed_windows[0].start = '24:00';
        cfg.fixed_windows[0].end = '1:00';
        cfg.fixed_windows[0].name = '  ';
        const fields = clientFieldErrors(cfg).map((e) => e.field);
        expect(fields).toEqual([
            'daily_cap_post',
            'expire_days',
            'windows[0].prizes[0].exp',
            'fixed_windows[0].name',
            'fixed_windows[0].start',
            'fixed_windows[0].end'
        ]);
    });

    it('새 줄은 운영값 없이 0·빈칸으로 시작하고, 이름·시각을 채우라고 알린다', () => {
        expect(emptyPrize()).toEqual({ weight: 0, points: 0, exp: 0 });
        expect(emptyWindow().odds).toBe(0);
        const cfg = sampleConfig();
        cfg.fixed_windows.push(emptyFixedWindow());
        const fields = clientFieldErrors(cfg).map((e) => e.field);
        expect(fields).toEqual([
            'fixed_windows[1].name',
            'fixed_windows[1].start',
            'fixed_windows[1].end'
        ]);
    });

    it('게시판 일괄 폼', () => {
        const lucky = { enabled: true, points: 1, odds: 1, comment_odds: 0, prizes: [] };
        expect(clientBoardErrors([], lucky).map((e) => e.field)).toEqual(['board_ids']);
        expect(clientBoardErrors(['free'], { ...lucky, odds: -1 }).map((e) => e.field)).toEqual([
            'lucky.odds'
        ]);
    });
});

describe('시각·안내', () => {
    it('HH:MM 형식', () => {
        expect(isValidClock('00:00')).toBe(true);
        expect(isValidClock('23:59')).toBe(true);
        expect(isValidClock('24:00')).toBe(false);
        expect(isValidClock('7:00')).toBe(false);
        expect(isValidClock('')).toBe(false);
    });

    it('확률 0·같은 시각·자정 넘김·하루 종일 안내', () => {
        const base = { ...emptyFixedWindow(), name: 'x', start: '01:00', end: '02:00' };
        expect(fixedWindowNotes({ ...base, odds: 1, comment_odds: 1 })).toEqual([]);
        expect(fixedWindowNotes({ ...base, odds: 0, comment_odds: 1 })[0]).toContain(
            '열리지 않습니다'
        );
        expect(fixedWindowNotes({ ...base, odds: 1, comment_odds: 0 })[0]).toContain('댓글');
        expect(
            fixedWindowNotes({ ...base, odds: 1, comment_odds: 1, start: '03:00', end: '03:00' })
        ).toEqual(['시작과 끝이 같으면 열리지 않습니다.']);
        expect(
            fixedWindowNotes({ ...base, odds: 1, comment_odds: 1, start: '23:00', end: '01:00' })[0]
        ).toContain('자정');
        expect(
            fixedWindowNotes({
                ...base,
                odds: 1,
                comment_odds: 1,
                start: ALL_DAY_START,
                end: ALL_DAY_END
            })
        ).toEqual(['하루 종일(00:00~23:59)은 마지막 1분(23:59~24:00)이 빠집니다.']);
    });

    it('KST 오늘', () => {
        expect(kstToday(new Date('2026-10-01T15:30:00Z'))).toBe('2026-10-02');
        expect(kstToday(new Date('2026-10-01T14:59:00Z'))).toBe('2026-10-01');
    });
});
