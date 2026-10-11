import { describe, it, expect } from 'vitest';
import {
    TAKEDOWN_TYPES,
    TAKEDOWN_OTHER_LABEL,
    formatTakedownSince,
    summarizeTakedownStats
} from './report-takedown';

describe('summarizeTakedownStats — 필드 유무', () => {
    it('필드가 없거나 객체가 아니면 null (예전 보고서 그대로)', () => {
        expect(summarizeTakedownStats(undefined)).toBeNull();
        expect(summarizeTakedownStats(null)).toBeNull();
        expect(summarizeTakedownStats('x')).toBeNull();
        expect(summarizeTakedownStats(3)).toBeNull();
        expect(summarizeTakedownStats([])).toBeNull();
    });

    it('빈 객체면 행 없이 0건 요약', () => {
        expect(summarizeTakedownStats({})).toEqual({
            rows: [],
            weekTotal: 0,
            total: 0,
            sinceLabel: null
        });
    });
});

describe('summarizeTakedownStats — 라벨 매핑', () => {
    it('알려진 유형 7종의 라벨', () => {
        const labels = Object.fromEntries(TAKEDOWN_TYPES.map((t) => [t.key, t.label]));
        expect(labels).toEqual({
            rights_infringement: '권리침해(임시조치)',
            election_commission: '선거관리위원회',
            adsense_policy: '애드센스 정책',
            copyright_infringement: '저작권',
            kisa: 'KISA',
            kcc: '방미통위',
            dispute_mediation: '분쟁조정위원회'
        });
    });

    it('정해진 순서로 나오고 기타는 마지막', () => {
        const s = summarizeTakedownStats({
            week: { zzz: 1, kcc: 2, rights_infringement: 3 },
            total: { kisa: 4 }
        });
        expect(s?.rows.map((r) => r.key)).toEqual(['rights_infringement', 'kisa', 'kcc', 'other']);
        expect(s?.rows.at(-1)?.label).toBe(TAKEDOWN_OTHER_LABEL);
    });

    it('unknown 및 모르는 유형은 기타 한 줄로 합친다', () => {
        const s = summarizeTakedownStats({
            week: { unknown: 1, foo: 2, kisa: 1 },
            total: { unknown: 5, bar: 3, kisa: 2 }
        });
        const other = s?.rows.find((r) => r.label === TAKEDOWN_OTHER_LABEL);
        expect(other).toMatchObject({ week: 3, total: 8 });
        expect(s?.rows.filter((r) => r.label === TAKEDOWN_OTHER_LABEL)).toHaveLength(1);
    });
});

describe('summarizeTakedownStats — 집계', () => {
    it('이번 주·누적 합계', () => {
        const s = summarizeTakedownStats({
            week: { rights_infringement: 2, adsense_policy: 1 },
            total: { rights_infringement: 10, adsense_policy: 4, copyright_infringement: 1 },
            since: '2025-03-01'
        });
        expect(s?.weekTotal).toBe(3);
        expect(s?.total).toBe(15);
        expect(s?.sinceLabel).toBe('2025.03.01 부터');
        expect(s?.rows.find((r) => r.key === 'copyright_infringement')).toMatchObject({
            week: 0,
            total: 1
        });
    });

    it('이번 주 0건이어도 누적 행은 남는다', () => {
        const s = summarizeTakedownStats({ week: {}, total: { kisa: 2 } });
        expect(s?.weekTotal).toBe(0);
        expect(s?.rows).toEqual([{ key: 'kisa', label: 'KISA', week: 0, total: 2 }]);
    });

    it('0·음수·숫자 아닌 값은 0으로, 양쪽 0인 유형은 뺀다', () => {
        const s = summarizeTakedownStats({
            week: { kisa: -1, kcc: 'abc', election_commission: '2' },
            total: { kisa: 0, kcc: null, election_commission: 2 }
        });
        expect(s?.rows).toEqual([
            { key: 'election_commission', label: '선거관리위원회', week: 2, total: 2 }
        ]);
    });

    it('week·total 이 객체가 아니면 빈 것으로 본다', () => {
        const s = summarizeTakedownStats({ week: [1, 2], total: 'x' });
        expect(s?.rows).toEqual([]);
    });
});

describe('formatTakedownSince', () => {
    it('YYYY-MM-DD → YYYY.MM.DD 부터', () => {
        expect(formatTakedownSince('2024-11-05')).toBe('2024.11.05 부터');
        expect(formatTakedownSince('2024-11-05T00:00:00Z')).toBe('2024.11.05 부터');
    });

    it('없거나 형식이 다르면 null', () => {
        expect(formatTakedownSince(undefined)).toBeNull();
        expect(formatTakedownSince('')).toBeNull();
        expect(formatTakedownSince('11/05/2024')).toBeNull();
        expect(formatTakedownSince(20241105)).toBeNull();
    });
});
