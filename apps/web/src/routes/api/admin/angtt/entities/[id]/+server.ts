/**
 * 앙티티 작품 관리 API — 작품 1건 (관리자 전용)
 *
 * PATCH {canonicalTitle?, slug?, aliases?, type?, releaseDate?, posterUrl?, autoLink?,
 *        contextTerms?, tmdbId?, tmdbKind?}                       → 편집
 * POST  {action: 'approve' | 'reject' | 'restore' | 'merge', targetId?} → 상태 변경
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/require-admin.js';
import {
    EntityAdminError,
    approveEntity,
    mergeEntity,
    rejectEntity,
    restoreEntity,
    updateEntity,
    type EntityEditInput
} from '$lib/server/angtt-entity-admin';

const NO_STORE = { 'cache-control': 'private, no-store' };

function fail(err: unknown): Response {
    if (err instanceof EntityAdminError) {
        return json(
            { success: false, error: err.message },
            { status: err.status, headers: NO_STORE }
        );
    }
    console.error('[admin/angtt/entities/:id]', err);
    return json(
        { success: false, error: '처리 중 오류가 발생했습니다.' },
        { status: 500, headers: NO_STORE }
    );
}

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const body = await request.json();
        return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    const id = parseId(params.id);
    const body = await readBody(request);
    if (!id || !body) {
        return json(
            { success: false, error: '잘못된 요청입니다.' },
            { status: 400, headers: NO_STORE }
        );
    }
    try {
        await updateEntity(id, body as EntityEditInput, String(locals.user?.id ?? ''));
        return json({ success: true }, { headers: NO_STORE });
    } catch (err) {
        return fail(err);
    }
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    const id = parseId(params.id);
    const body = await readBody(request);
    if (!id || !body) {
        return json(
            { success: false, error: '잘못된 요청입니다.' },
            { status: 400, headers: NO_STORE }
        );
    }
    const adminId = String(locals.user?.id ?? '');
    try {
        switch (body.action) {
            case 'approve': {
                const result = await approveEntity(id, adminId);
                return json({ success: true, ...result }, { headers: NO_STORE });
            }
            case 'reject':
                await rejectEntity(id, adminId);
                return json({ success: true }, { headers: NO_STORE });
            case 'restore':
                await restoreEntity(id, adminId);
                return json({ success: true }, { headers: NO_STORE });
            case 'merge': {
                const result = await mergeEntity(id, Number(body.targetId), adminId);
                return json({ success: true, ...result }, { headers: NO_STORE });
            }
            default:
                return json(
                    { success: false, error: '알 수 없는 동작입니다.' },
                    { status: 400, headers: NO_STORE }
                );
        }
    } catch (err) {
        return fail(err);
    }
};
