import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '$lib/server/db';
import type { Currency, PaymentOrder, PaymentProviderId, PaymentStatus } from '../types/index.js';

interface OrderRow extends RowDataPacket {
    id: number;
    site_id: number;
    user_id: number;
    order_uid: string;
    provider: string;
    pg_order_id: string | null;
    pg_transaction_id: string | null;
    amount: string | number;
    currency: string;
    status: string;
    description: string | null;
    metadata_json: string | null;
    paid_at: Date | null;
    refunded_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

function rowToOrder(r: OrderRow): PaymentOrder {
    return {
        id: r.id,
        siteId: r.site_id,
        userId: r.user_id,
        orderUid: r.order_uid,
        provider: r.provider as PaymentProviderId,
        pgOrderId: r.pg_order_id,
        pgTransactionId: r.pg_transaction_id,
        amount: typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount,
        currency: r.currency as Currency,
        status: r.status as PaymentStatus,
        description: r.description,
        metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as Record<string, unknown>) : null,
        paidAt: r.paid_at,
        refundedAt: r.refunded_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at
    };
}

export async function createOrder(input: {
    siteId: number;
    userId: number;
    orderUid: string;
    provider: PaymentProviderId;
    amount: number;
    currency: Currency;
    description?: string;
    metadata?: Record<string, unknown>;
}): Promise<PaymentOrder> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO payment_orders
         (site_id, user_id, order_uid, provider, amount, currency, description, metadata_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
            input.siteId,
            input.userId,
            input.orderUid,
            input.provider,
            input.amount,
            input.currency,
            input.description ?? null,
            input.metadata ? JSON.stringify(input.metadata) : null
        ]
    );
    const id = result.insertId;
    const order = await getOrderById(id);
    if (!order) throw new Error('order create failed');
    return order;
}

export async function getOrderById(id: number): Promise<PaymentOrder | null> {
    const [rows] = await pool.query<OrderRow[]>(
        'SELECT * FROM payment_orders WHERE id = ? LIMIT 1',
        [id]
    );
    return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function getOrderByUid(orderUid: string): Promise<PaymentOrder | null> {
    const [rows] = await pool.query<OrderRow[]>(
        'SELECT * FROM payment_orders WHERE order_uid = ? LIMIT 1',
        [orderUid]
    );
    return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function updateOrderStatus(
    id: number,
    status: PaymentStatus,
    extra: { pgOrderId?: string; pgTransactionId?: string; paidAt?: Date; refundedAt?: Date } = {}
): Promise<void> {
    await pool.query<ResultSetHeader>(
        `UPDATE payment_orders SET
            status = ?,
            pg_order_id = COALESCE(?, pg_order_id),
            pg_transaction_id = COALESCE(?, pg_transaction_id),
            paid_at = COALESCE(?, paid_at),
            refunded_at = COALESCE(?, refunded_at)
         WHERE id = ?`,
        [
            status,
            extra.pgOrderId ?? null,
            extra.pgTransactionId ?? null,
            extra.paidAt ?? null,
            extra.refundedAt ?? null,
            id
        ]
    );
}

export async function recordEvent(input: {
    orderId: number | null;
    siteId: number;
    provider: PaymentProviderId;
    eventType: string;
    payload: Record<string, unknown>;
    signatureValid: boolean | null;
}): Promise<void> {
    await pool.query<ResultSetHeader>(
        `INSERT INTO payment_events
         (order_id, site_id, provider, event_type, payload_json, signature_valid)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            input.orderId,
            input.siteId,
            input.provider,
            input.eventType,
            JSON.stringify(input.payload),
            input.signatureValid === null ? null : input.signatureValid ? 1 : 0
        ]
    );
}
