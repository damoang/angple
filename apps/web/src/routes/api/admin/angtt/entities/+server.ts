/**
 * 앙티티 작품 관리 API — 목록·수동 등록 (관리자 전용)
 *
 * GET  ?status=pending|active|rejected|merged  → 목록 + 상태별 개수 + 병합 대상 + TMDB 사용 가능 여부
 * POST {canonicalTitle, type, slug?, aliases?, releaseDate?, posterUrl?, status?, …} → 수동 등록
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/require-admin.js';
import {
    EntityAdminError,
    createEntity,
    listEntitiesForAdmin,
    type AdminEntityStatus,
    type CreateEntityInput
} from '$lib/server/angtt-entity-admin';
import { isTmdbEnabled } from '$lib/server/angtt-tmdb';

const NO_STORE = { 'cache-control': 'private, no-store' };
const STATUSES: readonly AdminEntityStatus[] = ['pending', 'active', 'rejected', 'merged'];

function fail(err: unknown): Response {
    if (err instanceof EntityAdminError) {
        return json(
            { success: false, error: err.message },
            { status: err.status, headers: NO_STORE }
        );
    }
    console.error('[admin/angtt/entities]', err);
    return json(
        { success: false, error: '처리 중 오류가 발생했습니다.' },
        { status: 500, headers: NO_STORE }
    );
}

export const GET: RequestHandler = async ({ locals, url }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    const raw = url.searchParams.get('status') ?? 'pending';
    const status = (STATUSES as readonly string[]).includes(raw)
        ? (raw as AdminEntityStatus)
        : 'pending';
    try {
        const data = await listEntitiesForAdmin(status);
        return json(
            { success: true, ...data, tmdbEnabled: isTmdbEnabled() },
            { headers: NO_STORE }
        );
    } catch (err) {
        return fail(err);
    }
};

export const POST: RequestHandler = async ({ locals, request }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json(
            { success: false, error: '잘못된 요청입니다.' },
            { status: 400, headers: NO_STORE }
        );
    }
    try {
        const id = await createEntity(body as CreateEntityInput, String(locals.user?.id ?? ''));
        return json({ success: true, id }, { headers: NO_STORE });
    } catch (err) {
        return fail(err);
    }
};
