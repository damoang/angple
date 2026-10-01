/**
 * 관리자 앙팡(럭키 포인트) API 클라이언트.
 *
 * 백엔드: /api/v2/admin/lucky/* (JWT + 관리자 레벨). 다른 관리자 API(admin-xp 등)와 같이
 * 쿠키 인증(credentials: 'include')으로 부른다.
 *
 * ⛔ PUT /config 본문은 GET 응답의 config 객체만이다. 응답 전체(boards·history 등)를 보내면
 *    알 수 없는 키로 400 이다 — buildPutConfigBody 를 거쳐 보낸다.
 */
import { safeJson } from './safe-json.js';
import {
    buildPutConfigBody,
    type LuckyAdminConfig,
    type LuckyBoardLucky,
    type LuckyFieldError
} from '$lib/utils/angpang-admin';

const API_BASE = '/api/v2/admin/lucky';

export interface LuckyBoardSetting {
    board_id: string;
    subject: string;
    /** null 이면 그 게시판에 lucky 설정 키 자체가 없다 */
    lucky: LuckyBoardLucky | null;
}

export interface LuckyConfigHistoryEntry {
    /** KST RFC3339 */
    at: string;
    by: string;
    before: unknown;
    after: unknown;
}

export interface LuckyAdminConfigView {
    config: LuckyAdminConfig;
    boards: LuckyBoardSetting[];
    /** 최신순 */
    history: LuckyConfigHistoryEntry[];
    /** 다른 서버(파드)가 새 설정을 보기까지 걸릴 수 있는 최대 시간 */
    cache_ttl_seconds: number;
    /** 저장된 원문이 엄격 검증을 통과하지 못함 — 이대로 저장하면 원문이 덮어써진다 */
    stored_parse_error: boolean;
    stored_parse_message?: LuckyFieldError[];
    stored_raw?: unknown;
}

export interface LuckyKindStats {
    wins: number;
    /** 0 = 무제한 */
    cap: number;
    /** 무제한이면 null */
    remaining: number | null;
}

export interface LuckyRecentGrant {
    board_id: string;
    wr_id: string;
    kind: 'post' | 'comment';
    amount: number;
    exp: number;
    tier: string;
    /** 지급 시각(KST RFC3339) */
    at: string;
    nickname: string;
}

export interface LuckyAdminStats {
    date: string;
    post: LuckyKindStats;
    comment: LuckyKindStats;
    points_total: number;
    exp_total: number;
    members: number;
    tiers: { tier: string; count: number }[];
    recent: LuckyRecentGrant[];
}

/** 백엔드 오류. 400 이면 fields 에 필드별 메시지가 있다. */
export class LuckyAdminError extends Error {
    status: number;
    fields: LuckyFieldError[];
    constructor(message: string, status: number, fields: LuckyFieldError[] = []) {
        super(message);
        this.name = 'LuckyAdminError';
        this.status = status;
        this.fields = fields;
    }
}

interface V2Response<T> {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
}

function toFieldErrors(details: unknown): LuckyFieldError[] {
    if (!Array.isArray(details)) return [];
    return details
        .filter((d): d is { field?: unknown; message?: unknown } => !!d && typeof d === 'object')
        .map((d) => ({
            field: typeof d.field === 'string' ? d.field : '',
            message: typeof d.message === 'string' ? d.message : ''
        }));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: 'include', ...init });
    let body: V2Response<T> | null = null;
    try {
        body = await safeJson<V2Response<T>>(response);
    } catch (e) {
        if (response.ok) throw e;
    }
    if (!response.ok || !body || body.data === undefined) {
        const message = body?.error?.message || `HTTP ${response.status}`;
        throw new LuckyAdminError(message, response.status, toFieldErrors(body?.error?.details));
    }
    return body.data;
}

export function getLuckyAdminConfig(): Promise<LuckyAdminConfigView> {
    return request<LuckyAdminConfigView>(`${API_BASE}/config`);
}

/** config 객체만 보낸다. 저장된(정규화된) config 를 돌려준다. */
export async function putLuckyAdminConfig(config: LuckyAdminConfig): Promise<LuckyAdminConfig> {
    const data = await request<{ config: LuckyAdminConfig }>(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPutConfigBody(config))
    });
    return data.config;
}

/** 고른 게시판들의 lucky 키를 통째로 바꾼다(다른 게시판 설정 키는 보존). */
export function putLuckyAdminBoards(
    boardIds: string[],
    lucky: LuckyBoardLucky
): Promise<{ board_ids: string[]; lucky: LuckyBoardLucky }> {
    return request(`${API_BASE}/boards`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_ids: boardIds, lucky })
    });
}

/** date: YYYY-MM-DD(KST). 비우면 오늘. */
export function getLuckyAdminStats(date?: string): Promise<LuckyAdminStats> {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<LuckyAdminStats>(`${API_BASE}/stats${q}`);
}
