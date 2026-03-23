/**
 * 자동 등급 승급 시스템
 * 로그인 일수 + XP 조건 기반 자동 mb_level 승급
 *
 * 조건: 로그인 일수와 XP 임계값 모두 충족 시 승급
 * - 등급2 → 등급3: 7일 이상 + 3,000 XP
 * - 등급3 → 등급4: 14일 이상 + 6,000 XP
 */
import pool, { readPool } from '$lib/server/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { QueryError } from 'mysql2';
import {
    getRecentPromotionHistory as getRecentPromotionHistoryFromLog,
    insertMemberLevelHistory,
    isMissingLevelHistoryTableError,
    LEVEL_HISTORY_REASONS,
    type MemberLevelHistoryReason
} from './member-level-history.js';

/** 승급 조건 설정 타입 */
export interface PromotionRule {
    fromLevel: number;
    toLevel: number;
    minLoginDays: number;
    minXP: number;
}

export interface PromotionEligibility {
    mb_level: number;
    as_exp: number;
    login_days: number;
    mb_certify?: string | null;
}

/** 기본 승급 규칙 (현재 등급3 승급만, 등급4 이상은 추후 설정) */
export const DEFAULT_PROMOTION_RULES: PromotionRule[] = [
    { fromLevel: 2, toLevel: 3, minLoginDays: 7, minXP: 3000 }
    // 등급4 이상 승급 규칙은 추후 추가 예정
    // 등급5(광고앙)는 광고주 전용으로 자동 승급 대상 아님
];

interface MemberPromotionData extends RowDataPacket {
    mb_id: string;
    mb_level: number;
    as_exp: number;
    login_days: number;
    mb_certify: string;
}

interface PromotionConfig extends RowDataPacket {
    settings_json: string | null;
}

function isMissingSiteSettingsTable(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    return (err as QueryError & { code?: string }).code === 'ER_NO_SUCH_TABLE';
}

/**
 * site_settings에서 승급 규칙 조회
 * 설정이 없으면 기본값 반환
 */
export async function getPromotionRules(): Promise<PromotionRule[]> {
    try {
        const [rows] = await readPool.query<PromotionConfig[]>(
            `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
        );

        if (rows[0]?.settings_json) {
            const settings = JSON.parse(rows[0].settings_json);
            if (settings.promotion_rules && Array.isArray(settings.promotion_rules)) {
                return settings.promotion_rules;
            }
        }
    } catch (err) {
        if (isMissingSiteSettingsTable(err)) {
            return DEFAULT_PROMOTION_RULES;
        }
        console.error('[AutoPromotion] Failed to load rules:', err);
    }

    return DEFAULT_PROMOTION_RULES;
}

/**
 * site_settings에 승급 규칙 저장
 */
export async function savePromotionRules(rules: PromotionRule[]): Promise<void> {
    // 기존 설정 로드
    const [rows] = await readPool.query<PromotionConfig[]>(
        `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
    );

    let settings: Record<string, unknown> = {};
    if (rows[0]?.settings_json) {
        try {
            settings = JSON.parse(rows[0].settings_json);
        } catch {
            settings = {};
        }
    }

    settings.promotion_rules = rules;
    const jsonStr = JSON.stringify(settings);

    if (rows.length === 0) {
        await pool.query(
            `INSERT INTO site_settings (site_id, settings_json, active_theme) VALUES ('default', ?, 'damoang-official')`,
            [jsonStr]
        );
    } else {
        await pool.query(`UPDATE site_settings SET settings_json = ? WHERE site_id = 'default'`, [
            jsonStr
        ]);
    }
}

/**
 * 특정 회원의 로그인 일수 조회
 * g5_member.mb_login_days를 직접 사용 (Go 백엔드 + SvelteKit 누적값)
 * 이전: g5_na_xp 기반 COUNT → SvelteKit 전환 후 데이터만 집계되어 과소 산정
 */
async function getLoginDays(mbId: string): Promise<number> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT COALESCE(mb_login_days, 0) as login_days FROM g5_member WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    return rows[0]?.login_days ?? 0;
}

interface CheckAndPromoteOptions {
    reason?: MemberLevelHistoryReason;
}

export function findApplicablePromotionRule(
    member: PromotionEligibility,
    rules: PromotionRule[]
): PromotionRule | null {
    if ((member.mb_certify || '').trim() === '') {
        return null;
    }

    return (
        rules.find(
            (rule) =>
                rule.fromLevel === member.mb_level &&
                member.login_days >= rule.minLoginDays &&
                member.as_exp >= rule.minXP
        ) || null
    );
}

/**
 * 회원의 승급 가능 여부 확인 및 승급 실행
 * @returns 승급 결과 (null: 승급 안됨, object: 승급됨)
 */
export async function checkAndPromoteMember(
    mbId: string,
    options: CheckAndPromoteOptions = {}
): Promise<{
    promoted: boolean;
    oldLevel?: number;
    newLevel?: number;
} | null> {
    const rules = await getPromotionRules();
    const reason = options.reason ?? LEVEL_HISTORY_REASONS.AUTO_PROMOTE_LOGIN_WEB;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [memberRows] = await conn.query<
            (MemberPromotionData &
                RowDataPacket & {
                    as_level: number;
                    mb_datetime: Date | null;
                })[]
        >(
            `SELECT mb_id, mb_level, COALESCE(as_exp, 0) as as_exp, COALESCE(as_level, 0) as as_level,
                    COALESCE(mb_login_days, 0) as login_days, COALESCE(mb_certify, '') as mb_certify,
                    mb_datetime
             FROM g5_member
             WHERE mb_id = ?
             LIMIT 1
             FOR UPDATE`,
            [mbId]
        );

        const member = memberRows[0];
        if (!member || member.mb_level >= 5) {
            await conn.rollback();
            return null;
        }

        const applicableRule = findApplicablePromotionRule(
            {
                mb_level: member.mb_level,
                as_exp: member.as_exp,
                login_days: member.login_days,
                mb_certify: member.mb_certify
            },
            rules
        );
        if (!applicableRule) {
            await conn.rollback();
            return null;
        }

        const [updateResult] = await conn.query<ResultSetHeader>(
            `UPDATE g5_member SET mb_level = ? WHERE mb_id = ? AND mb_level = ?`,
            [applicableRule.toLevel, mbId, applicableRule.fromLevel]
        );
        if (updateResult.affectedRows !== 1) {
            await conn.rollback();
            return null;
        }

        try {
            await insertMemberLevelHistory(conn, {
                mbId: member.mb_id,
                oldMbLevel: applicableRule.fromLevel,
                newMbLevel: applicableRule.toLevel,
                reason,
                snapshotAsLevel: member.as_level,
                snapshotAsExp: member.as_exp,
                snapshotLoginDays: member.login_days,
                snapshotMbCertify: member.mb_certify,
                memberCreatedAt: member.mb_datetime
            });
        } catch (err) {
            if (isMissingLevelHistoryTableError(err)) {
                console.warn(
                    `[AutoPromotion] level history table missing, skip log for ${mbId}:`,
                    err
                );
            } else {
                throw err;
            }
        }

        await conn.commit();

        console.log(
            `[AutoPromotion] ${mbId} promoted: ${applicableRule.fromLevel} → ${applicableRule.toLevel} ` +
                `(loginDays: ${member.login_days}, xp: ${member.as_exp})`
        );

        return {
            promoted: true,
            oldLevel: applicableRule.fromLevel,
            newLevel: applicableRule.toLevel
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * 승급 대상 회원 목록 조회 (관리자용)
 * 조건 충족했지만 아직 승급 안 된 회원들
 */
export async function getPromotionCandidates(): Promise<
    Array<{
        mb_id: string;
        mb_nick: string;
        mb_level: number;
        as_exp: number;
        login_days: number;
        eligible_for: number;
    }>
> {
    const rules = await getPromotionRules();
    const candidates: Array<{
        mb_id: string;
        mb_nick: string;
        mb_level: number;
        as_exp: number;
        login_days: number;
        eligible_for: number;
    }> = [];

    for (const rule of rules) {
        // 해당 등급 회원 중 XP 조건 충족자 조회
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT m.mb_id, m.mb_nick, m.mb_level, COALESCE(m.as_exp, 0) as as_exp,
                    COALESCE(m.mb_login_days, 0) as login_days
             FROM g5_member m
             WHERE m.mb_level = ?
               AND COALESCE(m.as_exp, 0) >= ?
               AND COALESCE(m.mb_login_days, 0) >= ?
               AND COALESCE(m.mb_certify, '') <> ''
               AND m.mb_leave_date = ''
               AND m.mb_intercept_date = ''
             ORDER BY login_days DESC, as_exp DESC
             LIMIT 100`,
            [rule.fromLevel, rule.minXP, rule.minLoginDays]
        );

        for (const row of rows) {
            candidates.push({
                mb_id: row.mb_id,
                mb_nick: row.mb_nick,
                mb_level: row.mb_level,
                as_exp: row.as_exp,
                login_days: row.login_days,
                eligible_for: rule.toLevel
            });
        }
    }

    return candidates;
}

/**
 * 모든 승급 대상 회원 일괄 승급 (관리자용)
 */
export async function promoteAllEligible(): Promise<{
    promoted: number;
    failed: number;
}> {
    const candidates = await getPromotionCandidates();
    let promoted = 0;
    let failed = 0;

    for (const candidate of candidates) {
        try {
            const result = await checkAndPromoteMember(candidate.mb_id, {
                reason: LEVEL_HISTORY_REASONS.ADMIN_MANUAL_BULK
            });
            if (result?.promoted) {
                promoted++;
            }
        } catch (err) {
            console.error(`[AutoPromotion] Failed to promote ${candidate.mb_id}:`, err);
            failed++;
        }
    }

    return { promoted, failed };
}

export async function getRecentPromotionHistory(days = 4, limit = 100) {
    return getRecentPromotionHistoryFromLog(days, limit);
}
