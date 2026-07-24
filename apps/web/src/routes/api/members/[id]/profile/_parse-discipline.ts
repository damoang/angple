/**
 * disciplinelog wr_content (JSON 문자열) 에서 제재 정보 추출
 * SvelteKit +server.ts 는 HTTP 메서드만 export 가능하므로
 * helper 는 underscore-prefix 파일로 분리 (테스트 가능 + 빌드 통과)
 */

export interface DisciplineEntry {
    penalty_period: number;
    penalty_date_from: string;
    sg_types?: string[];
    wr_id?: number;
    /** 소명 인용 등으로 회수(revoke)된 제재 — 프로필 이력에서는 제외한다 */
    revoked?: boolean;
}

/**
 * - 파싱 실패 시 null 반환 (호출부에서 skip)
 * - penalty_period 가 없으면 null 반환
 * - penalty_date_from 미존재 시 wr_datetime 으로 fallback
 */
export function parseDisciplineLogContent(row: {
    wr_id?: number;
    wr_content: string;
    wr_datetime: string;
}): DisciplineEntry | null {
    if (!row.wr_content) return null;
    try {
        const parsed = JSON.parse(row.wr_content);
        if (parsed.penalty_period === undefined || parsed.penalty_period === null) {
            return null;
        }
        const entry: DisciplineEntry = {
            penalty_period: Number(parsed.penalty_period),
            penalty_date_from: String(parsed.penalty_date_from || row.wr_datetime || ''),
            wr_id: row.wr_id
        };
        if (Array.isArray(parsed.sg_types)) {
            entry.sg_types = parsed.sg_types.map((t: unknown) => String(t));
        }
        if (typeof parsed.revoked_at === 'string' && parsed.revoked_at !== '') {
            entry.revoked = true;
        }
        return entry;
    } catch {
        return null;
    }
}
