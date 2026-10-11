/**
 * 운영 리포트 「외부 요청 처리」 섹션 — wr_9 JSON 의 takedown_stats 정리
 *
 * takedown_stats 형태:
 *   { week: { [type]: count }, total: { [type]: count }, since: 'YYYY-MM-DD' }
 *
 * 알려진 유형은 고정 순서로, 그 밖의 유형은 모두 「기타」 한 줄로 합친다.
 */

export interface TakedownStats {
    week?: Record<string, number>;
    total?: Record<string, number>;
    since?: string;
}

export interface TakedownRow {
    key: string;
    label: string;
    week: number;
    total: number;
}

export interface TakedownSummary {
    rows: TakedownRow[];
    weekTotal: number;
    total: number;
    /** 「YYYY.MM.DD 부터」 — since 가 없거나 형식이 다르면 null */
    sinceLabel: string | null;
}

/** 유형 코드 → 표시 라벨 (배열 순서 = 표 순서) */
export const TAKEDOWN_TYPES: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'rights_infringement', label: '권리침해(임시조치)' },
    { key: 'election_commission', label: '선거관리위원회' },
    { key: 'adsense_policy', label: '애드센스 정책' },
    { key: 'copyright_infringement', label: '저작권' },
    { key: 'kisa', label: 'KISA' },
    { key: 'kcc', label: '방미통위' },
    { key: 'dispute_mediation', label: '분쟁조정위원회' }
];

export const TAKEDOWN_OTHER_KEY = 'other';
export const TAKEDOWN_OTHER_LABEL = '기타';

const KNOWN_KEYS = new Set(TAKEDOWN_TYPES.map((t) => t.key));

function toCount(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function toCountMap(v: unknown): Record<string, number> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return v as Record<string, number>;
}

/** 'YYYY-MM-DD' → 'YYYY.MM.DD 부터' */
export function formatTakedownSince(since: unknown): string | null {
    if (typeof since !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(since.trim());
    if (!m) return null;
    return `${m[1]}.${m[2]}.${m[3]} 부터`;
}

/**
 * takedown_stats 를 표 행으로 정리한다.
 * 값이 객체가 아니면(필드 없는 예전 보고서 포함) null — 섹션을 그리지 않는다.
 * 이번 주·누적 모두 0인 유형은 행에서 뺀다.
 */
export function summarizeTakedownStats(raw: unknown): TakedownSummary | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const src = raw as TakedownStats;
    const week = toCountMap(src.week);
    const total = toCountMap(src.total);

    const rows: TakedownRow[] = TAKEDOWN_TYPES.map((t) => ({
        key: t.key,
        label: t.label,
        week: toCount(week[t.key]),
        total: toCount(total[t.key])
    }));

    const other: TakedownRow = {
        key: TAKEDOWN_OTHER_KEY,
        label: TAKEDOWN_OTHER_LABEL,
        week: 0,
        total: 0
    };
    for (const [k, v] of Object.entries(week)) {
        if (!KNOWN_KEYS.has(k)) other.week += toCount(v);
    }
    for (const [k, v] of Object.entries(total)) {
        if (!KNOWN_KEYS.has(k)) other.total += toCount(v);
    }
    rows.push(other);

    const visible = rows.filter((r) => r.week > 0 || r.total > 0);
    return {
        rows: visible,
        weekTotal: visible.reduce((s, r) => s + r.week, 0),
        total: visible.reduce((s, r) => s + r.total, 0),
        sinceLabel: formatTakedownSince(src.since)
    };
}
