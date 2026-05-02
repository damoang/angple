/**
 * POST /api/plugins/brickang/orders/start
 *
 * 흐름:
 *   1. body 검증 (brick_type, quantity 1~100, message ≤100자, building_id, provider, returnUrl, cancelUrl)
 *   2. brick_type 조회 → server-side 가격 산정 (클라 입력 신뢰 X)
 *   3. is_anonymous=1 이면 message=null, nickname='익명' 강제
 *   4. orderUid 생성 (BRK-YYYYMMDD-XXXXXX)
 *   5. 내부 fetch 로 plugins/payment/checkout/start 호출 → metadata.kind='brickang' 저장
 *   6. 응답 { order_uid, amount, currency, provider, payment }
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { getBrickTypeBySlug } from '../../server/brick-types.js';
import { getBuildingById } from '../../server/buildings.js';
import { requireUser } from '../../server/auth.js';
import type { BrickTypeSlug } from '../../types/index.js';

const DEFAULT_ANONYMOUS_DAILY_CAP = 100;

interface CountRow extends RowDataPacket {
    cnt: number;
}

/**
 * 익명 등급 일일 한도 검사 — 동일 user_id 가 오늘 결제한 익명 벽돌 INSERT 카운트 기준.
 *
 * `payment_orders.metadata->>'$.brick_type_slug'='anonymous'` 로 익명 주문만 카운트.
 * brickang_bricks.placed_at 가 오늘 (서버 로컬 시간) 인 행 수.
 *
 * @returns 현재 카운트 (cap 미초과 시) — 호출자가 cap 비교
 */
export async function countAnonymousBricksToday(userId: number): Promise<number> {
    const [rows] = await readPool.query<CountRow[]>(
        `SELECT COUNT(*) AS cnt
         FROM brickang_bricks b
         INNER JOIN payment_orders po ON b.payment_order_id = po.id
         WHERE b.user_id = ?
           AND JSON_UNQUOTE(JSON_EXTRACT(po.metadata, '$.brick_type_slug')) = 'anonymous'
           AND DATE(b.placed_at) = CURDATE()`,
        [userId]
    );
    return rows[0]?.cnt ?? 0;
}

/**
 * settings.anonymous_daily_cap (plugin.json) 또는 DEFAULT 반환.
 * 현재 plugin settings 동적 로드 인프라가 brickang 에 없어서 default 만 사용.
 * Phase 2 에서 settings store 연동 예정.
 */
export function getAnonymousDailyCap(): number {
    return DEFAULT_ANONYMOUS_DAILY_CAP;
}

interface StartRequestBody {
    brick_type: BrickTypeSlug;
    quantity: number;
    message?: string | null;
    building_id: number;
    provider: 'toss' | 'naver' | 'paypal';
    returnUrl: string;
    cancelUrl: string;
}

function generateOrderUid(): string {
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate()
    ).padStart(2, '0')}`;
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BRK-${yyyymmdd}-${rand}`;
}

export async function POST(event: RequestEvent): Promise<Response> {
    const user = requireUser(event);

    let body: StartRequestBody;
    try {
        body = (await event.request.json()) as StartRequestBody;
    } catch {
        throw error(400, 'invalid json');
    }

    if (!body.brick_type) throw error(400, 'brick_type required');
    if (!body.building_id) throw error(400, 'building_id required');
    if (!body.provider) throw error(400, 'provider required');
    if (!body.returnUrl || !body.cancelUrl) throw error(400, 'returnUrl/cancelUrl required');

    const quantity = Math.floor(Number(body.quantity ?? 1));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
        throw error(400, 'quantity must be between 1 and 100');
    }

    const brickType = await getBrickTypeBySlug(body.brick_type);
    if (!brickType || !brickType.isActive) {
        throw error(400, `unknown brick_type: ${body.brick_type}`);
    }

    const building = await getBuildingById(body.building_id);
    if (!building) throw error(404, 'building not found');
    if (building.status !== 'active') throw error(400, 'building not active');

    // 익명 등급 일일 한도 검사 (어뷰징 방지)
    if (brickType.slug === 'anonymous') {
        const cap = getAnonymousDailyCap();
        const todayCount = await countAnonymousBricksToday(user.userId);
        if (todayCount + quantity > cap) {
            throw error(400, 'anonymous_daily_cap_exceeded');
        }
    }

    // 익명 등급 정책: 메시지 강제 null + 닉네임 '익명'
    let message: string | null = body.message?.trim() || null;
    let nicknameSnapshot = user.nickname;
    if (brickType.isAnonymous) {
        message = null;
        nicknameSnapshot = '익명';
    } else if (!brickType.allowMessage) {
        message = null;
    } else if (message && message.length > 100) {
        throw error(400, 'message too long (max 100 chars)');
    }

    // PayPal 은 1000원 이상에서만 활성 (요구사항)
    if (body.provider === 'paypal' && brickType.priceKrw < 1000) {
        throw error(400, 'PayPal not available for this brick type');
    }

    const orderUid = generateOrderUid();
    const amount = brickType.priceKrw * quantity;
    const currency = body.provider === 'paypal' ? 'USD' : 'KRW';
    const finalAmount = currency === 'USD' ? brickType.priceUsd * quantity : amount;

    const metadata = {
        kind: 'brickang',
        brick_type_slug: brickType.slug,
        quantity,
        message,
        building_id: body.building_id,
        is_anonymous: brickType.isAnonymous,
        nickname_snapshot: nicknameSnapshot
    };

    // plugins/payment/checkout/start 위임 호출 (서버 내부 fetch)
    const paymentRes = await event.fetch('/api/plugins/payment/checkout/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            provider: body.provider,
            amount: finalAmount,
            currency,
            description: `브릭앙 ${brickType.name} ${quantity}개`,
            returnUrl: body.returnUrl,
            cancelUrl: body.cancelUrl,
            metadata: { ...metadata, order_uid: orderUid }
        })
    });

    if (!paymentRes.ok) {
        const text = await paymentRes.text();
        console.error(
            '[brickang/orders/start] payment delegation failed:',
            paymentRes.status,
            text
        );
        throw error(paymentRes.status, `payment start failed: ${text}`);
    }

    const payment = (await paymentRes.json()) as {
        orderUid: string;
        provider: string;
        sandbox: boolean;
        sdkParams: Record<string, unknown> | null;
        redirectUrl: string | null;
        pgOrderId: string;
    };

    return json({
        order_uid: payment.orderUid,
        brick_order_uid: orderUid,
        amount: finalAmount,
        currency,
        provider: body.provider,
        brick_type: brickType.slug,
        quantity,
        payment
    });
}
