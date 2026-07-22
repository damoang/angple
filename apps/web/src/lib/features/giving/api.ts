/**
 * 나눔 게임 API 클라이언트. SvelteKit 프록시(/api/plugins/giving/*)를 경유하며,
 * 프록시가 세션 쿠키 → 백엔드 인증 헤더 주입을 처리한다(별도 토큰 첨부 불필요).
 */

import type { GivingMethod } from './methods.js';
import type { LadderData } from './pure/ladder.js';

const BASE = '/api/plugins/giving';

export interface GivingDrawResult {
    method: string;
    winner_mb_id: string | null;
    winning_number: number | null;
    seed: string | null;
    seed_hash: string | null;
    drawn_by: string | null;
    drawn_at: string | null;
    result: {
        method: string;
        participants?: string[];
        winners?: string[];
        winning_number?: number;
        no_winner?: boolean;
        input_hash?: string;
        seed?: string;
        seed_hash?: string;
        capacity?: number;
        ladder?: LadderData;
        reason?: string;
        designated?: boolean;
        drawn_by?: string;
    } | null;
}

export interface GivingDetail {
    wr_id: number;
    title: string;
    host_mb_id: string;
    method: GivingMethod;
    capacity: number | null;
    number_max: number | null;
    seed_hash: string | null;
    config_status: string;
    unit_price: number;
    status: 'active' | 'waiting' | 'paused' | 'ended' | 'no_giving';
    is_paused: boolean;
    is_urgent: boolean;
    giving_start: string | null;
    giving_end: string | null;
    participant_count: number;
    participants: string[];
    total_numbers: number;
    total_bids: number;
    is_host: boolean;
    my_participation: {
        joined: boolean;
        numbers: string;
        count: number;
        points: number;
    };
    draw?: GivingDrawResult;
    reveal_bids?: Array<{ mb_id: string; numbers: string }>;
}

interface Envelope<T> {
    success: boolean;
    data?: T;
    error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'same-origin',
        headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
        ...init
    });
    let body: Envelope<T>;
    try {
        body = (await res.json()) as Envelope<T>;
    } catch {
        throw new Error(`서버 응답 오류 (${res.status})`);
    }
    if (!res.ok || !body.success) {
        throw new Error(body.error || `요청 실패 (${res.status})`);
    }
    return body.data as T;
}

export const givingApi = {
    detail(id: number | string): Promise<GivingDetail> {
        return call<GivingDetail>(`/detail/${id}`);
    },

    config(
        id: number | string,
        payload: { method: GivingMethod; capacity?: number | null; number_max?: number | null }
    ): Promise<{ wr_id: number; method: string; seed_hash: string }> {
        return call(`/config/${id}`, { method: 'POST', body: JSON.stringify(payload) });
    },

    /** lowest_unique: numbers 필요. 무료형: numbers 생략. */
    bid(id: number | string, numbers?: string): Promise<Record<string, unknown>> {
        return call(`/bid/${id}`, {
            method: 'POST',
            body: JSON.stringify(numbers != null ? { numbers } : {})
        });
    },

    draw(
        id: number | string,
        payload?: { winner_mb_id?: string; reason?: string }
    ): Promise<Record<string, unknown>> {
        return call(`/draw/${id}`, {
            method: 'POST',
            body: JSON.stringify(payload ?? {})
        });
    },

    admin(
        id: number | string,
        action: 'pause' | 'resume' | 'force-stop'
    ): Promise<{ status: string }> {
        return call(`/admin/${id}/${action}`, { method: 'POST', body: '{}' });
    }
};
