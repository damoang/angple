/**
 * orders.test.ts — `routes/orders/start.ts` + `confirm.ts` 핵심 흐름 통합 테스트 (모킹).
 *
 * 시나리오:
 *  start.ts:
 *   - anonymous 등급: message=null + nickname='익명' 강제 → metadata 에 반영
 *   - 일반 등급: 사용자 nickname 보존 + message 유지
 *   - 클라 amount 무시 + 서버 산정 (priceKrw * quantity)
 *   - anonymous_daily_cap 초과 시 400
 *
 *  confirm.ts:
 *   - payment_orders.metadata.kind !== 'brickang' 시 400
 *   - 트랜잭션 rollback 시 brick INSERT 0건 (실제 DB 호출 0건 확인)
 *   - milestone 100 도달 시 events 행 INSERT 호출됨
 *
 * fetch + mysql2 + brickang 의존성 모듈을 모두 mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- 1. 모킹: brickang server modules ----
const mockGetBrickTypeBySlug = vi.fn();
const mockGetBuildingById = vi.fn();
const mockCountAnonymousToday = vi.fn();
const mockReadPoolQuery = vi.fn();
const mockPoolQuery = vi.fn();
const mockGetBuildingForUpdate = vi.fn();
const mockGetOccupiedSet = vi.fn();
const mockIncrementCurrentBricks = vi.fn();
const mockUpsertUserStats = vi.fn();
const mockCheckAndRecordMilestones = vi.fn();
const mockInvalidateBuildingSnapshot = vi.fn();
const mockPushRecentBrick = vi.fn();
const mockConnQuery = vi.fn();
const mockConnBegin = vi.fn();
const mockConnCommit = vi.fn();
const mockConnRollback = vi.fn();
const mockConnRelease = vi.fn();

vi.mock('../server/db.js', () => ({
    pool: {
        query: (...args: unknown[]) => mockPoolQuery(...args),
        getConnection: vi.fn(async () => ({
            query: (...args: unknown[]) => mockConnQuery(...args),
            beginTransaction: () => mockConnBegin(),
            commit: () => mockConnCommit(),
            rollback: () => mockConnRollback(),
            release: () => mockConnRelease()
        }))
    },
    readPool: {
        query: (...args: unknown[]) => mockReadPoolQuery(...args)
    }
}));

vi.mock('../server/brick-types.js', () => ({
    getBrickTypeBySlug: (...args: unknown[]) => mockGetBrickTypeBySlug(...args)
}));

vi.mock('../server/buildings.js', () => ({
    getBuildingById: (...args: unknown[]) => mockGetBuildingById(...args),
    getBuildingForUpdate: (...args: unknown[]) => mockGetBuildingForUpdate(...args),
    getOccupiedSet: (...args: unknown[]) => mockGetOccupiedSet(...args),
    incrementCurrentBricks: (...args: unknown[]) => mockIncrementCurrentBricks(...args)
}));

vi.mock('../server/stats-aggregator.js', () => ({
    upsertUserStats: (...args: unknown[]) => mockUpsertUserStats(...args),
    checkAndRecordMilestones: (...args: unknown[]) => mockCheckAndRecordMilestones(...args)
}));

vi.mock('../server/snapshot.js', () => ({
    invalidateBuildingSnapshot: (...args: unknown[]) => mockInvalidateBuildingSnapshot(...args),
    pushRecentBrick: (...args: unknown[]) => mockPushRecentBrick(...args)
}));

// ---- helpers ----
function makeRequestEvent(body: unknown, user: { mb_no: number; mb_nickname: string } | null) {
    const fetchMock = vi.fn();
    return {
        fetchMock,
        event: {
            request: {
                json: async () => body
            },
            locals: { user },
            fetch: fetchMock
        } as unknown as import('@sveltejs/kit').RequestEvent
    };
}

const ANON_TYPE = {
    id: 1,
    slug: 'anonymous',
    name: '익명 100원',
    priceKrw: 100,
    priceUsd: 0.1,
    colorHex: '#888',
    textureUrl: null,
    sizeMultiplier: 1,
    glowEffect: false,
    isAnonymous: true,
    allowMessage: false,
    isActive: true,
    sortOrder: 1
};

const NORMAL_TYPE = {
    id: 2,
    slug: 'normal',
    name: '일반',
    priceKrw: 1000,
    priceUsd: 1,
    colorHex: '#c84c32',
    textureUrl: null,
    sizeMultiplier: 1,
    glowEffect: false,
    isAnonymous: false,
    allowMessage: true,
    isActive: true,
    sortOrder: 2
};

const ACTIVE_BUILDING = {
    id: 1,
    name: 'A',
    description: null,
    targetBricks: 1000,
    currentBricks: 0,
    status: 'active' as const,
    blueprintData: null,
    dimensionX: 5,
    dimensionY: 3,
    dimensionZ: 5,
    season: 1,
    createdAt: new Date(),
    completedAt: null
};

beforeEach(() => {
    vi.clearAllMocks();
    // default: anon today count = 0
    mockReadPoolQuery.mockResolvedValue([[{ cnt: 0 }]]);
});

// ---- start.ts tests ----
describe('orders/start.ts', () => {
    it('일반 등급 → message + 사용자 nickname 보존, 클라 amount 무시', async () => {
        mockGetBrickTypeBySlug.mockResolvedValue(NORMAL_TYPE);
        mockGetBuildingById.mockResolvedValue(ACTIVE_BUILDING);
        const { POST } = await import('../routes/orders/start.js');
        const { event, fetchMock } = makeRequestEvent(
            {
                brick_type: 'normal',
                quantity: 3,
                message: '응원합니다',
                building_id: 1,
                provider: 'toss',
                returnUrl: '/r',
                cancelUrl: '/c',
                amount: 99999999 // 클라가 보낸 잘못된 amount — 무시되어야 함
            },
            { mb_no: 42, mb_nickname: '홍길동' }
        );
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    orderUid: 'PAY-1',
                    provider: 'toss',
                    sandbox: true,
                    sdkParams: {},
                    redirectUrl: null,
                    pgOrderId: 'pg-1'
                }),
                { status: 200 }
            )
        );

        const res = await POST(event);
        expect(res.status).toBe(200);

        const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        // 서버 산정 amount = priceKrw * quantity = 1000 * 3
        expect(calledBody.amount).toBe(3000);
        expect(calledBody.metadata.nickname_snapshot).toBe('홍길동');
        expect(calledBody.metadata.message).toBe('응원합니다');
        expect(calledBody.metadata.is_anonymous).toBe(false);
        expect(calledBody.metadata.kind).toBe('brickang');
    });

    it('anonymous 등급 → message=null + nickname=익명 강제', async () => {
        mockGetBrickTypeBySlug.mockResolvedValue(ANON_TYPE);
        mockGetBuildingById.mockResolvedValue(ACTIVE_BUILDING);
        const { POST } = await import('../routes/orders/start.js');
        const { event, fetchMock } = makeRequestEvent(
            {
                brick_type: 'anonymous',
                quantity: 1,
                message: '비밀 메시지',
                building_id: 1,
                provider: 'toss',
                returnUrl: '/r',
                cancelUrl: '/c'
            },
            { mb_no: 42, mb_nickname: '홍길동' }
        );
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    orderUid: 'PAY-2',
                    provider: 'toss',
                    sandbox: true,
                    sdkParams: {},
                    redirectUrl: null,
                    pgOrderId: 'pg-2'
                }),
                { status: 200 }
            )
        );

        await POST(event);
        const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(calledBody.metadata.nickname_snapshot).toBe('익명');
        expect(calledBody.metadata.message).toBeNull();
        expect(calledBody.metadata.is_anonymous).toBe(true);
        expect(calledBody.amount).toBe(100); // priceKrw 100 * 1
    });

    it('anonymous_daily_cap 초과 시 400', async () => {
        mockGetBrickTypeBySlug.mockResolvedValue(ANON_TYPE);
        mockGetBuildingById.mockResolvedValue(ACTIVE_BUILDING);
        // 오늘 이미 100개 카운트
        mockReadPoolQuery.mockResolvedValue([[{ cnt: 100 }]]);
        const { POST } = await import('../routes/orders/start.js');
        const { event } = makeRequestEvent(
            {
                brick_type: 'anonymous',
                quantity: 1,
                building_id: 1,
                provider: 'toss',
                returnUrl: '/r',
                cancelUrl: '/c'
            },
            { mb_no: 42, mb_nickname: '홍길동' }
        );

        await expect(POST(event)).rejects.toMatchObject({
            status: 400
        });
    });

    it('anonymous_daily_cap 미초과 시 정상 진행', async () => {
        mockGetBrickTypeBySlug.mockResolvedValue(ANON_TYPE);
        mockGetBuildingById.mockResolvedValue(ACTIVE_BUILDING);
        mockReadPoolQuery.mockResolvedValue([[{ cnt: 50 }]]); // 50 < 100
        const { POST } = await import('../routes/orders/start.js');
        const { event, fetchMock } = makeRequestEvent(
            {
                brick_type: 'anonymous',
                quantity: 1,
                building_id: 1,
                provider: 'toss',
                returnUrl: '/r',
                cancelUrl: '/c'
            },
            { mb_no: 42, mb_nickname: '홍길동' }
        );
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    orderUid: 'PAY-3',
                    provider: 'toss',
                    sandbox: true,
                    sdkParams: {},
                    redirectUrl: null,
                    pgOrderId: 'pg-3'
                }),
                { status: 200 }
            )
        );
        const res = await POST(event);
        expect(res.status).toBe(200);
    });
});

// ---- confirm.ts tests ----
describe('orders/confirm.ts', () => {
    it('payment_orders.metadata.kind !== brickang 시 400', async () => {
        // payment complete OK
        const { POST } = await import('../routes/orders/confirm.js');
        const { event, fetchMock } = makeRequestEvent(
            { order_uid: 'PAY-X', pg_order_id: 'pg-x', amount: 1000 },
            { mb_no: 42, mb_nickname: '홍길동' }
        );
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        // payment_orders 행: metadata.kind = 'subscription' (다른 플러그인)
        mockPoolQuery.mockResolvedValueOnce([
            [
                {
                    id: 99,
                    user_id: 42,
                    order_uid: 'PAY-X',
                    amount: 1000,
                    currency: 'KRW',
                    status: 'paid',
                    metadata_json: JSON.stringify({ kind: 'subscription' })
                }
            ]
        ]);

        await expect(POST(event)).rejects.toMatchObject({ status: 400 });
        // brick INSERT 0건 (트랜잭션 시작도 안 함)
        expect(mockConnBegin).not.toHaveBeenCalled();
    });

    it('트랜잭션 안에서 INSERT 실패 → rollback 호출 + 외부 캐시 무효화 호출 X', async () => {
        const { POST } = await import('../routes/orders/confirm.js');
        const { event, fetchMock } = makeRequestEvent(
            { order_uid: 'PAY-Y', pg_order_id: 'pg-y', amount: 1000 },
            { mb_no: 42, mb_nickname: '홍길동' }
        );
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        mockPoolQuery.mockResolvedValueOnce([
            [
                {
                    id: 100,
                    user_id: 42,
                    order_uid: 'PAY-Y',
                    amount: 1000,
                    currency: 'KRW',
                    status: 'paid',
                    metadata_json: JSON.stringify({
                        kind: 'brickang',
                        brick_type_slug: 'normal',
                        quantity: 1,
                        message: 'hi',
                        building_id: 1,
                        is_anonymous: false,
                        nickname_snapshot: '홍길동'
                    })
                }
            ]
        ]);
        mockGetBrickTypeBySlug.mockResolvedValue(NORMAL_TYPE);
        mockGetBuildingForUpdate.mockResolvedValue(ACTIVE_BUILDING);
        mockGetOccupiedSet.mockResolvedValue(new Set<string>());
        // INSERT 시 알 수 없는 에러 (DUP_ENTRY 가 아닌 일반 에러) → rollback
        mockConnQuery.mockRejectedValue(new Error('boom'));

        await expect(POST(event)).rejects.toThrow();
        expect(mockConnBegin).toHaveBeenCalled();
        expect(mockConnRollback).toHaveBeenCalled();
        expect(mockConnCommit).not.toHaveBeenCalled();
        // 캐시 무효화는 트랜잭션 commit 후에만 호출됨 → rollback 시 X
        expect(mockInvalidateBuildingSnapshot).not.toHaveBeenCalled();
    });

    it('milestone 100 도달 시 checkAndRecordMilestones 호출됨', async () => {
        const { POST } = await import('../routes/orders/confirm.js');
        const { event, fetchMock } = makeRequestEvent(
            { order_uid: 'PAY-Z', pg_order_id: 'pg-z', amount: 1000 },
            { mb_no: 42, mb_nickname: '홍길동' }
        );
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        mockPoolQuery.mockResolvedValueOnce([
            [
                {
                    id: 101,
                    user_id: 42,
                    order_uid: 'PAY-Z',
                    amount: 1000,
                    currency: 'KRW',
                    status: 'paid',
                    metadata_json: JSON.stringify({
                        kind: 'brickang',
                        brick_type_slug: 'normal',
                        quantity: 1,
                        message: null,
                        building_id: 1,
                        is_anonymous: false,
                        nickname_snapshot: '홍길동'
                    })
                }
            ]
        ]);
        mockGetBrickTypeBySlug.mockResolvedValue(NORMAL_TYPE);
        // currentBricks=99 → quantity 1 → newCount=100 (milestone)
        // dim 10x10x10 = 1000 slots 확보
        mockGetBuildingForUpdate.mockResolvedValue({
            ...ACTIVE_BUILDING,
            dimensionX: 10,
            dimensionY: 10,
            dimensionZ: 10,
            currentBricks: 99
        });
        mockGetOccupiedSet.mockResolvedValue(new Set<string>());
        // INSERT 성공
        mockConnQuery.mockResolvedValue([{ insertId: 1 } as never]);

        const res = await POST(event);
        expect(res.status).toBe(200);
        expect(mockCheckAndRecordMilestones).toHaveBeenCalledWith(expect.anything(), 1, 99, 100);
        expect(mockConnCommit).toHaveBeenCalled();
        expect(mockInvalidateBuildingSnapshot).toHaveBeenCalledWith(1);
    });
});
