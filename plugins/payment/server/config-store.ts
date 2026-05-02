/**
 * payment_provider_configs 테이블 조회/저장 헬퍼.
 * 사이트별 PG 키를 격리 저장.
 *
 * 주의: credentials_json은 평문 저장이지만 Phase 3에서 KMS/envelope 암호화로 교체 예정.
 */

import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '$lib/server/db';
import type { PaymentProviderId, ProviderConfig } from '../types/index.js';

interface ConfigRow extends RowDataPacket {
    id: number;
    site_id: number;
    provider: string;
    sandbox: number;
    active: number;
    credentials_json: string;
    config_json: string | null;
}

export async function getProviderConfig(
    siteId: number,
    provider: PaymentProviderId
): Promise<ProviderConfig | null> {
    const [rows] = await pool.query<ConfigRow[]>(
        'SELECT * FROM payment_provider_configs WHERE site_id = ? AND provider = ? AND active = 1 LIMIT 1',
        [siteId, provider]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
        siteId: r.site_id,
        provider: r.provider as PaymentProviderId,
        sandbox: r.sandbox === 1,
        active: r.active === 1,
        credentials: JSON.parse(r.credentials_json) as Record<string, string>,
        config: r.config_json ? (JSON.parse(r.config_json) as Record<string, unknown>) : undefined
    };
}

export async function listSiteProviders(siteId: number): Promise<ProviderConfig[]> {
    const [rows] = await pool.query<ConfigRow[]>(
        'SELECT * FROM payment_provider_configs WHERE site_id = ? AND active = 1',
        [siteId]
    );
    return rows.map((r) => ({
        siteId: r.site_id,
        provider: r.provider as PaymentProviderId,
        sandbox: r.sandbox === 1,
        active: r.active === 1,
        credentials: JSON.parse(r.credentials_json) as Record<string, string>,
        config: r.config_json ? (JSON.parse(r.config_json) as Record<string, unknown>) : undefined
    }));
}

export async function upsertProviderConfig(
    siteId: number,
    provider: PaymentProviderId,
    update: {
        sandbox: boolean;
        active: boolean;
        credentials: Record<string, string>;
        config?: Record<string, unknown>;
    }
): Promise<void> {
    await pool.query<ResultSetHeader>(
        `INSERT INTO payment_provider_configs (site_id, provider, sandbox, active, credentials_json, config_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            sandbox = VALUES(sandbox),
            active = VALUES(active),
            credentials_json = VALUES(credentials_json),
            config_json = VALUES(config_json),
            updated_at = CURRENT_TIMESTAMP`,
        [
            siteId,
            provider,
            update.sandbox ? 1 : 0,
            update.active ? 1 : 0,
            JSON.stringify(update.credentials),
            update.config ? JSON.stringify(update.config) : null
        ]
    );
}
