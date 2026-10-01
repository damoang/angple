import { describe, expect, it } from 'vitest';
import {
    collectLuckyRows,
    formatLuckyAtShort,
    formatLuckyBadge,
    formatLuckyMeta,
    formatLuckyTitle,
    luckyFields,
    luckyTierNamesFromConfig,
    parseLuckyTier,
    toKstIso
} from './lucky-badge';

describe('formatLuckyBadge', () => {
    it('포인트만', () => {
        expect(formatLuckyBadge(1234)).toBe('🍀1,234p');
        expect(formatLuckyBadge(1234, 0)).toBe('🍀1,234p');
    });

    it('경험치만', () => {
        expect(formatLuckyBadge(0, 500)).toBe('🍀500XP');
    });

    it('둘 다', () => {
        expect(formatLuckyBadge(1234, 500)).toBe('🍀1,234p·500XP');
    });

    it('둘 다 0 이하이거나 없으면 빈 문자열', () => {
        expect(formatLuckyBadge(0, 0)).toBe('');
        expect(formatLuckyBadge(-5, -1)).toBe('');
        expect(formatLuckyBadge(undefined, undefined)).toBe('');
        expect(formatLuckyBadge(null, null)).toBe('');
        expect(formatLuckyBadge(Number.NaN, Number.NaN)).toBe('');
    });

    it('음수 갈래는 무시하고 양수 갈래만 표시', () => {
        expect(formatLuckyBadge(-10, 500)).toBe('🍀500XP');
        expect(formatLuckyBadge(1234, -1)).toBe('🍀1,234p');
    });
});

describe('parseLuckyTier', () => {
    it('기본 회차명 + 「 럭키 」로 시작할 때만', () => {
        expect(parseLuckyTier('앙복타임 럭키 당첨')).toBe('앙복타임');
        expect(parseLuckyTier('앙팡타임 럭키 당첨')).toBe('앙팡타임');
        expect(parseLuckyTier('앙팡팡타임 럭키 포인트(댓글)')).toBe('앙팡팡타임');
    });

    it('레거시·불일치는 undefined', () => {
        expect(parseLuckyTier('럭키 포인트 당첨')).toBeUndefined();
        expect(parseLuckyTier('나리야 럭키 포인트')).toBeUndefined();
        expect(parseLuckyTier('앙팡팡타임')).toBeUndefined();
        expect(parseLuckyTier('앙팡타임 당첨')).toBeUndefined();
        expect(parseLuckyTier('[앙팡타임] 당첨')).toBeUndefined();
        expect(parseLuckyTier(' 앙팡타임 럭키 당첨')).toBeUndefined();
        expect(parseLuckyTier(null)).toBeUndefined();
        expect(parseLuckyTier(undefined)).toBeUndefined();
    });

    it('설정 이름은 목록에 있을 때만 인정한다', () => {
        expect(parseLuckyTier('새벽타임 럭키 포인트', ['새벽타임'])).toBe('새벽타임');
        expect(parseLuckyTier('새벽타임 럭키 포인트')).toBeUndefined();
        expect(parseLuckyTier('새벽타임 럭키 포인트', ['다른이름'])).toBeUndefined();
    });

    it('기본 이름으로 시작하는 설정 이름을 기본 이름으로 잘못 읽지 않는다(긴 이름 우선)', () => {
        const names = ['앙팡타임 새벽'];
        expect(parseLuckyTier('앙팡타임 새벽 럭키 포인트', names)).toBe('앙팡타임 새벽');
        expect(parseLuckyTier('앙팡타임 럭키 포인트', names)).toBe('앙팡타임');
        // 설정에서 지워진 이름은 기본 이름으로 떨어지지 않고 라벨이 없다
        expect(parseLuckyTier('앙팡타임 새벽 럭키 포인트')).toBeUndefined();
    });

    it('설정 이름 앞뒤 공백·빈 이름은 무시', () => {
        expect(parseLuckyTier('심야 럭키 포인트', ['  심야 ', ''])).toBe('심야');
    });
});

describe('luckyTierNamesFromConfig', () => {
    it('windows·fixed_windows 이름을 중복 없이 순서대로', () => {
        expect(
            luckyTierNamesFromConfig({
                windows: [{ name: '가' }, { name: ' 나 ' }],
                fixed_windows: [{ name: '다' }, { name: '가' }, { name: '' }, {}]
            })
        ).toEqual(['가', '나', '다']);
    });

    it('모양이 깨졌으면 빈 배열', () => {
        expect(luckyTierNamesFromConfig(null)).toEqual([]);
        expect(luckyTierNamesFromConfig('x')).toEqual([]);
        expect(luckyTierNamesFromConfig({ windows: 'x', fixed_windows: [null] })).toEqual([]);
    });
});

describe('toKstIso', () => {
    it('KST 문자열은 벽시계 그대로 +09:00', () => {
        expect(toKstIso('2026-10-01 14:23:05')).toBe('2026-10-01T14:23:05+09:00');
    });

    it('Date 는 KST 벽시계로', () => {
        expect(toKstIso(new Date('2026-10-01T05:23:05Z'))).toBe('2026-10-01T14:23:05+09:00');
        // 날짜 경계: UTC 15시 = KST 다음날 0시
        expect(toKstIso(new Date('2026-09-30T15:00:00Z'))).toBe('2026-10-01T00:00:00+09:00');
    });

    it('잘못된 값은 undefined', () => {
        expect(toKstIso('0000-00-00 00:00:00')).toBeUndefined();
        expect(toKstIso(new Date('invalid'))).toBeUndefined();
        expect(toKstIso('')).toBeUndefined();
        expect(toKstIso(null)).toBeUndefined();
    });
});

describe('formatLuckyAtShort / formatLuckyMeta / formatLuckyTitle (KST 고정)', () => {
    it('+09:00 입력을 KST 월/일 시:분으로', () => {
        expect(formatLuckyAtShort('2026-10-01T14:23:05+09:00')).toBe('10/1 14:23');
        expect(formatLuckyAtShort('2026-01-09T03:04:00+09:00')).toBe('1/9 03:04');
    });

    it('다른 오프셋 입력도 KST 로 환산', () => {
        expect(formatLuckyAtShort('2026-10-01T05:23:00Z')).toBe('10/1 14:23');
        expect(formatLuckyAtShort('2026-09-30T15:30:00Z')).toBe('10/1 00:30');
    });

    it('잘못된 시각은 빈 문자열', () => {
        expect(formatLuckyAtShort('')).toBe('');
        expect(formatLuckyAtShort('nope')).toBe('');
        expect(formatLuckyAtShort(undefined)).toBe('');
    });

    it('라벨: 회차명이 있을 때만', () => {
        expect(formatLuckyMeta('앙팡팡타임', '2026-10-01T14:23:05+09:00')).toBe(
            '앙팡팡타임 · 10/1 14:23'
        );
        expect(formatLuckyMeta('앙팡타임', undefined)).toBe('앙팡타임');
        expect(formatLuckyMeta(undefined, '2026-10-01T14:23:05+09:00')).toBe('');
        expect(formatLuckyMeta('', '2026-10-01T14:23:05+09:00')).toBe('');
    });

    it('title: 회차명 있으면 전체 문구, 레거시는 기존 그대로', () => {
        expect(formatLuckyTitle('앙팡팡타임', '2026-10-01T14:23:05+09:00')).toBe(
            '럭키 당첨 · 앙팡팡타임 · 2026-10-01 14:23'
        );
        expect(formatLuckyTitle('앙복타임', undefined)).toBe('럭키 당첨 · 앙복타임');
        expect(formatLuckyTitle(undefined, '2026-10-01T14:23:05+09:00')).toBe('럭키 당첨');
    });
});

describe('collectLuckyRows', () => {
    const keys = { id: 'po_rel_id', amount: 'po_point', content: 'po_content', datetime: 'po_dt' };

    it('rel_id 별 금액·회차명·시각', () => {
        const map = collectLuckyRows(
            [
                {
                    po_rel_id: '7',
                    po_point: 100,
                    po_content: '앙팡타임 럭키 포인트',
                    po_dt: '2026-10-01 14:23:05'
                },
                {
                    po_rel_id: '8',
                    po_point: 50,
                    po_content: '럭키 포인트',
                    po_dt: '2025-01-02 03:04:05'
                }
            ],
            keys
        );
        expect(map.get(7)).toEqual({
            amount: 100,
            tier: '앙팡타임',
            at: '2026-10-01T14:23:05+09:00'
        });
        // 레거시만 있으면 tier·at 둘 다 없다
        expect(map.get(8)).toEqual({ amount: 50 });
    });

    it('섞이면 금액은 최댓값, 회차명·시각은 회차명 있는 행 중 가장 이른 행(백엔드와 동일)', () => {
        const map = collectLuckyRows(
            [
                {
                    po_rel_id: '1',
                    po_point: 10,
                    po_content: '앙팡팡타임 럭키 포인트',
                    po_dt: '2026-10-01 18:00:00'
                },
                {
                    po_rel_id: '1',
                    po_point: 30,
                    po_content: '레거시',
                    po_dt: '2026-10-01 09:00:00'
                },
                {
                    po_rel_id: '1',
                    po_point: 20,
                    po_content: '앙복타임 럭키 포인트',
                    po_dt: '2026-10-01 12:00:00'
                }
            ],
            keys
        );
        expect(map.get(1)).toEqual({
            amount: 30,
            tier: '앙복타임',
            at: '2026-10-01T12:00:00+09:00'
        });
    });

    it('같은 시각이면 먼저 본 행', () => {
        const map = collectLuckyRows(
            [
                {
                    po_rel_id: '2',
                    po_point: 5,
                    po_content: '앙팡타임 럭키 포인트',
                    po_dt: '2026-10-01 12:00:00'
                },
                {
                    po_rel_id: '2',
                    po_point: 50,
                    po_content: '앙팡팡타임 럭키 포인트',
                    po_dt: '2026-10-01 12:00:00'
                }
            ],
            keys
        );
        expect(map.get(2)).toEqual({
            amount: 50,
            tier: '앙팡타임',
            at: '2026-10-01T12:00:00+09:00'
        });
    });

    it('회차명이 있어도 시각이 없거나 잘못되면 tier·at 없음', () => {
        const map = collectLuckyRows(
            [
                { po_rel_id: '3', po_point: 10, po_content: '앙복타임 럭키 포인트', po_dt: null },
                {
                    po_rel_id: '3',
                    po_point: 10,
                    po_content: '앙팡타임 럭키 포인트',
                    po_dt: '0000-00-00 00:00:00'
                }
            ],
            keys
        );
        expect(map.get(3)).toEqual({ amount: 10 });
    });

    it('음수·비정상 금액은 0(백엔드 초기값과 동일)', () => {
        const map = collectLuckyRows(
            [{ po_rel_id: '4', po_point: -5, po_content: '레거시', po_dt: null }],
            keys
        );
        expect(map.get(4)).toEqual({ amount: 0 });
    });
});

describe('luckyFields (댓글 응답 병합)', () => {
    it('포인트만 있으면 lucky_point 만 싣는다 — 기존 응답과 동일', () => {
        expect(luckyFields({ amount: 100 }, undefined)).toEqual({ lucky_point: 100 });
    });

    it('경험치만 있으면 lucky_exp 만 싣는다', () => {
        expect(luckyFields(undefined, { amount: 50 })).toEqual({ lucky_exp: 50 });
    });

    it('둘 다 있으면 둘 다 싣는다', () => {
        expect(luckyFields({ amount: 100 }, { amount: 50 })).toEqual({
            lucky_point: 100,
            lucky_exp: 50
        });
    });

    it('둘 다 없거나 0 이하이면 키를 싣지 않는다', () => {
        expect(luckyFields(undefined, undefined)).toEqual({});
        expect(luckyFields({ amount: 0 }, { amount: 0 })).toEqual({});
        expect(luckyFields({ amount: -1 }, { amount: -1 })).toEqual({});
    });

    it('경험치 조회 실패(빈 맵) 시 포인트 응답은 그대로', () => {
        const pointMap = new Map([[7, { amount: 300 }]]);
        const expMap = new Map<number, { amount: number }>();
        expect(luckyFields(pointMap.get(7), expMap.get(7))).toEqual({ lucky_point: 300 });
    });

    it('회차명·시각을 싣는다', () => {
        expect(
            luckyFields(
                { amount: 100, tier: '앙팡팡타임', at: '2026-10-01T14:23:05+09:00' },
                { amount: 50, tier: '앙팡팡타임', at: '2026-10-01T14:23:05+09:00' }
            )
        ).toEqual({
            lucky_point: 100,
            lucky_exp: 50,
            lucky_tier: '앙팡팡타임',
            lucky_at: '2026-10-01T14:23:05+09:00'
        });
    });

    it('경험치만 회차명이 있으면 경험치 쪽 회차명·시각', () => {
        expect(
            luckyFields(
                { amount: 100 },
                { amount: 50, tier: '앙팡타임', at: '2026-10-01T14:23:05+09:00' }
            )
        ).toEqual({
            lucky_point: 100,
            lucky_exp: 50,
            lucky_tier: '앙팡타임',
            lucky_at: '2026-10-01T14:23:05+09:00'
        });
    });

    it('둘 다 회차명이 있으면 더 이른 쪽', () => {
        expect(
            luckyFields(
                { amount: 100, tier: '앙팡팡타임', at: '2026-10-01T18:00:00+09:00' },
                { amount: 50, tier: '앙복타임', at: '2026-10-01T09:00:00+09:00' }
            )
        ).toEqual({
            lucky_point: 100,
            lucky_exp: 50,
            lucky_tier: '앙복타임',
            lucky_at: '2026-10-01T09:00:00+09:00'
        });
    });

    it('같은 시각이면 포인트 쪽(백엔드가 포인트 행을 먼저 본다)', () => {
        expect(
            luckyFields(
                { amount: 100, tier: '앙팡타임', at: '2026-10-01T12:00:00+09:00' },
                { amount: 50, tier: '앙복타임', at: '2026-10-01T12:00:00+09:00' }
            )
        ).toEqual({
            lucky_point: 100,
            lucky_exp: 50,
            lucky_tier: '앙팡타임',
            lucky_at: '2026-10-01T12:00:00+09:00'
        });
    });

    it('레거시만 있으면 lucky_tier·lucky_at 둘 다 없다', () => {
        expect(luckyFields({ amount: 100 }, { amount: 50 })).toEqual({
            lucky_point: 100,
            lucky_exp: 50
        });
    });

    it('회차명만 있고 시각이 없으면(또는 반대) 둘 다 싣지 않는다', () => {
        expect(luckyFields({ amount: 100, tier: '앙복타임' }, undefined)).toEqual({
            lucky_point: 100
        });
        expect(luckyFields({ amount: 100, at: '2026-10-01T12:00:00+09:00' }, undefined)).toEqual({
            lucky_point: 100
        });
    });
});

describe('collectLuckyRows + 설정 이름', () => {
    const keys = { id: 'po_rel_id', amount: 'po_point', content: 'po_content', datetime: 'po_dt' };
    const rows = [
        {
            po_rel_id: '5',
            po_point: 40,
            po_content: '앙팡타임 새벽 럭키 포인트(댓글)',
            po_dt: '2026-10-01 03:00:00'
        }
    ];

    it('설정 이름이 있으면 그 이름이 회차명', () => {
        expect(collectLuckyRows(rows, keys, ['앙팡타임 새벽']).get(5)).toEqual({
            amount: 40,
            tier: '앙팡타임 새벽',
            at: '2026-10-01T03:00:00+09:00'
        });
    });

    it('설정 이름이 없으면 회차명 없음(기본 이름으로 오인하지 않음)', () => {
        expect(collectLuckyRows(rows, keys).get(5)).toEqual({ amount: 40 });
    });
});
