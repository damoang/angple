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
    /** 표시용 mb_id→닉네임 맵 (구 응답에는 없음 — mb_id 폴백) */
    nicknames?: Record<string, string> | null;
    winning_number: number | null;
    seed: string | null;
    seed_hash: string | null;
    drawn_by: string | null;
    drawn_at: string | null;
    /** N-3: 당첨 수령 확인(자동방식·정원1명). 미도래 나눔·구 응답엔 없음. */
    claim_due?: string | null;
    claimed_at?: string | null;
    redraw_count?: number;
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
    /**
     * 나눔 설정(g5_giving_meta)이 저장돼 있는지.
     *
     * false 면 백엔드가 참가·개표를 모두 거부하는 '준비 중' 상태다.
     * 글 작성이 ①글 생성 → ②설정 저장 두 단계라 ②가 실패하면 이렇게 된다.
     * 예전에는 백엔드가 기본값(유료)으로 폴백해 주최자가 알아챌 수 없었다.
     */
    configured: boolean;
    /** 미설정(configured=false)이면 빈 문자열 */
    method: GivingMethod;
    capacity: number | null;
    number_max: number | null;
    seed_hash: string | null;
    config_status: string;
    unit_price: number;
    /**
     * N-2 참가 조건. 0 이면 제한 없음. 구 응답에는 없으므로 optional.
     *
     * entry_point_cost 는 무료 방식에만 적용된다 — 유료(lowest_unique)는 번호당
     * 단가를 이미 내므로 백엔드가 참가비를 부과하지 않는다.
     * 차감된 포인트는 전액 소각되며 반환되지 않는다.
     */
    entry_min_days?: number;
    entry_point_cost?: number;
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
        payload: {
            method: GivingMethod;
            capacity?: number | null;
            number_max?: number | null;
            /**
             * N-2 참가 조건. 미전송이면 백엔드가 기존 값을 유지한다.
             * 응모가 1건이라도 있으면 변경 시 409 다.
             */
            entry_min_days?: number;
            entry_point_cost?: number;
        }
    ): Promise<{
        wr_id: number;
        method: string;
        seed_hash: string;
        entry_min_days?: number;
        entry_point_cost?: number;
    }> {
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

    /** N-3: 당첨자 수령 확인. 24h 내 미확인 시 재추첨된다. */
    claim(id: number | string): Promise<{ claimed: boolean }> {
        return call(`/claim/${id}`, { method: 'POST', body: '{}' });
    },

    admin(
        id: number | string,
        action: 'pause' | 'resume' | 'force-stop'
    ): Promise<{ status: string }> {
        return call(`/admin/${id}/${action}`, { method: 'POST', body: '{}' });
    }
};
