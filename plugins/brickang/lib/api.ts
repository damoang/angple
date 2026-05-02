/**
 * brickang 클라이언트 API 래퍼.
 * 모든 호출은 same-origin (`/api/plugins/brickang/*`) 으로 간다.
 */

const BASE = '/api/plugins/brickang';

async function request<T>(
    path: string,
    init: RequestInit & { fetch?: typeof fetch } = {}
): Promise<T> {
    const f = init.fetch ?? globalThis.fetch;
    const res = await f(`${BASE}${path}`, {
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
        ...init
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`brickang api ${path} failed: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
}

export const brickangApi = {
    listBrickTypes: () => request<{ brick_types: BrickTypeDto[] }>('/brick-types'),
    getBrickType: (slug: string) => request<BrickTypeDto>(`/brick-types/${slug}`),
    listBuildings: () => request<{ buildings: BuildingDto[] }>('/buildings'),
    getActive: () =>
        request<{ building: BuildingDto | null; recent: BrickDto[] }>('/buildings/active'),
    getBuilding: (id: number) => request<BuildingDto>(`/buildings/${id}`),
    getBuildingBricks: (id: number, opts: { limit?: number; offset?: number } = {}) => {
        const q = new URLSearchParams();
        if (opts.limit) q.set('limit', String(opts.limit));
        if (opts.offset) q.set('offset', String(opts.offset));
        return request<{ bricks: BrickDto[] }>(`/buildings/${id}/bricks?${q.toString()}`);
    },
    getRecentBricks: (id: number, limit = 10) =>
        request<{ bricks: BrickDto[] }>(`/buildings/${id}/bricks/recent?limit=${limit}`),
    getSnapshot: (id: number) => request(`/buildings/${id}/snapshot`),
    getBuildingRankings: (id: number, limit = 30) =>
        request(`/buildings/${id}/rankings?limit=${limit}`),
    startOrder: (body: StartOrderBody) =>
        request<StartOrderResponse>('/orders/start', {
            method: 'POST',
            body: JSON.stringify(body)
        }),
    confirmOrder: (body: ConfirmOrderBody) =>
        request<ConfirmOrderResponse>('/orders/confirm', {
            method: 'POST',
            body: JSON.stringify(body)
        }),
    getOrder: (orderUid: string) => request(`/orders/${orderUid}`),
    getMyBricks: (opts: { limit?: number; offset?: number } = {}) => {
        const q = new URLSearchParams();
        if (opts.limit) q.set('limit', String(opts.limit));
        if (opts.offset) q.set('offset', String(opts.offset));
        return request<{ bricks: BrickDto[] }>(`/me/bricks?${q.toString()}`);
    },
    getMyStats: () => request('/me/stats'),
    getRankingsAll: (limit = 50) => request(`/rankings/all?limit=${limit}`),
    getRankingsMonthly: (limit = 50) => request(`/rankings/monthly?limit=${limit}`)
};

export interface BrickTypeDto {
    id: number;
    slug: string;
    name: string;
    price_krw: number;
    price_usd: number;
    color_hex: string;
    size_multiplier: number;
    glow_effect: boolean;
    is_anonymous: boolean;
    allow_message: boolean;
    sort_order: number;
}

export interface BuildingDto {
    id: number;
    name: string;
    description?: string | null;
    target_bricks: number;
    current_bricks: number;
    progress_percent: number;
    status: string;
    dimension?: { x: number; y: number; z: number };
    season?: number;
}

export interface BrickDto {
    id: number;
    building_id?: number;
    nickname: string;
    message: string | null;
    position?: { x: number; y: number; z: number };
    placed_at: string;
    brick_type_slug: string;
    color: string | null;
}

export interface StartOrderBody {
    brick_type: string;
    quantity: number;
    message?: string | null;
    building_id: number;
    provider: 'toss' | 'naver' | 'paypal';
    returnUrl: string;
    cancelUrl: string;
}

export interface StartOrderResponse {
    order_uid: string;
    brick_order_uid: string;
    amount: number;
    currency: string;
    provider: string;
    brick_type: string;
    quantity: number;
    payment: {
        orderUid: string;
        provider: string;
        sandbox: boolean;
        sdkParams: Record<string, unknown> | null;
        redirectUrl: string | null;
        pgOrderId: string;
    };
}

export interface ConfirmOrderBody {
    order_uid: string;
    pg_order_id: string;
    pg_payment_key?: string;
    amount: number;
}

export interface ConfirmOrderResponse {
    success: boolean;
    bricks: Array<{
        id: number;
        position: { x: number; y: number; z: number };
        type: string;
        nickname: string;
    }>;
}
