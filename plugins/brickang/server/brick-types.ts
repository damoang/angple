/**
 * 벽돌 등급(5종) 캐시.
 *
 * 등급 정보는 거의 변하지 않으므로 프로세스 메모리에 5분 캐시한다.
 * 가격 산정은 항상 서버 측에서 DB 조회 결과(또는 캐시)로 수행한다 — 클라 입력 신뢰 X.
 */

import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from './db.js';
import type { BrickType, BrickTypeSlug } from '../types/index.js';

interface BrickTypeRow extends RowDataPacket {
    id: number;
    slug: string;
    name: string;
    price_krw: number;
    price_usd: string | number;
    color_hex: string;
    texture_url: string | null;
    size_multiplier: string | number;
    glow_effect: number;
    is_anonymous: number;
    allow_message: number;
    is_active: number;
    sort_order: number;
}

const TTL_MS = 5 * 60 * 1000;

let cache: BrickType[] | null = null;
let cachedAt = 0;

function rowToType(r: BrickTypeRow): BrickType {
    return {
        id: r.id,
        slug: r.slug as BrickTypeSlug,
        name: r.name,
        priceKrw: r.price_krw,
        priceUsd:
            typeof r.price_usd === 'string' ? parseFloat(r.price_usd) : (r.price_usd as number),
        colorHex: r.color_hex,
        textureUrl: r.texture_url,
        sizeMultiplier:
            typeof r.size_multiplier === 'string'
                ? parseFloat(r.size_multiplier)
                : (r.size_multiplier as number),
        glowEffect: r.glow_effect === 1,
        isAnonymous: r.is_anonymous === 1,
        allowMessage: r.allow_message === 1,
        isActive: r.is_active === 1,
        sortOrder: r.sort_order
    };
}

export async function listBrickTypes(force = false): Promise<BrickType[]> {
    const now = Date.now();
    if (!force && cache && now - cachedAt < TTL_MS) return cache;
    const [rows] = await readPool.query<BrickTypeRow[]>(
        'SELECT * FROM brickang_brick_types WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    cache = rows.map(rowToType);
    cachedAt = now;
    return cache;
}

export async function getBrickTypeBySlug(slug: string): Promise<BrickType | null> {
    const all = await listBrickTypes();
    const found = all.find((t) => t.slug === slug);
    if (found) return found;
    // 캐시에 없는 경우 DB 직접 조회 (비활성 등급도 조회 가능)
    const [rows] = await readPool.query<BrickTypeRow[]>(
        'SELECT * FROM brickang_brick_types WHERE slug = ? LIMIT 1',
        [slug]
    );
    return rows[0] ? rowToType(rows[0]) : null;
}

export async function getBrickTypeById(id: number): Promise<BrickType | null> {
    const all = await listBrickTypes();
    const found = all.find((t) => t.id === id);
    if (found) return found;
    const [rows] = await readPool.query<BrickTypeRow[]>(
        'SELECT * FROM brickang_brick_types WHERE id = ? LIMIT 1',
        [id]
    );
    return rows[0] ? rowToType(rows[0]) : null;
}

export function invalidateBrickTypeCache(): void {
    cache = null;
    cachedAt = 0;
}
