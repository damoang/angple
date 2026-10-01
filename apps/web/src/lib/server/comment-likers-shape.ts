/**
 * 댓글 추천자 배치 조회 결과의 모양과 가공 — DB·캐시에 의존하지 않는 부분.
 */

export interface CommentLiker {
    mb_id: string;
    mb_nick: string;
    mb_image: string;
    mb_image_updated_at?: string;
    bg_ip: string;
    liked_at: string;
}

export type CommentLikersBatch = Record<string, { likers: CommentLiker[]; total: number }>;

export interface LikerRow {
    wr_id: number;
    mb_id: string;
    mb_nick: string;
    mb_image_url: string;
    mb_image_updated_at: string | null;
    bg_ip: string;
    bg_datetime: string;
}

export interface CountRow {
    wr_id: number;
    total: number;
}

// bg_datetime 이 null / '' / '0000-00-00 00:00:00' 일 때 new Date() 가
// Invalid Date 를 반환하며, 이후 toLocaleString() 결과가 minify 돼서
// "va.id.Da" 같은 값으로 노출됨.
export function toSafeIso(raw: unknown): string {
    const s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
    if (!s || s.startsWith('0000')) return '';
    return s.replace(' ', 'T') + 'Z';
}

export function maskIp(ip: string | null | undefined): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        parts[1] = '♡';
        return parts.join('.');
    }
    return ip.slice(0, 3) + '.♡';
}

/** 조회 결과를 댓글 ID별로 묶는다. 요청한 ID 는 추천자가 없어도 빈 항목으로 들어간다. */
export function groupCommentLikers(
    commentIds: number[],
    countRows: CountRow[],
    likerRows: LikerRow[],
    isAuthenticated: boolean
): CommentLikersBatch {
    const totalMap = new Map<number, number>();
    for (const row of countRows) {
        totalMap.set(row.wr_id, row.total);
    }

    const data: CommentLikersBatch = {};
    for (const id of commentIds) {
        data[String(id)] = { likers: [], total: totalMap.get(id) ?? 0 };
    }

    for (const row of likerRows) {
        const entry = data[String(row.wr_id)];
        if (entry) {
            entry.likers.push({
                mb_id: row.mb_id,
                mb_nick: row.mb_nick,
                mb_image: row.mb_image_url || '',
                mb_image_updated_at: row.mb_image_updated_at || undefined,
                bg_ip: isAuthenticated ? maskIp(row.bg_ip) : '',
                liked_at: toSafeIso(row.bg_datetime)
            });
        }
    }

    return data;
}
