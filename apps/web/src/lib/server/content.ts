/**
 * g5_content 테이블 조회 헬퍼
 * 정적 페이지(이용약관, 개인정보처리방침 등) 로드
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { env } from '$env/dynamic/private';

export interface ContentRow {
    co_id: string;
    co_subject: string;
    co_content: string;
    co_html: number;
    co_skin: string;
    co_mobile_skin: string;
    co_tag_filter_use: number;
    co_hit: number;
    co_include_head: string;
    co_include_tail: string;
}

/** g5_content에서 co_id로 조회 */
export async function getContent(coId: string): Promise<ContentRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT co_id, co_subject, co_content, co_html FROM g5_content WHERE co_id = ? LIMIT 1',
        [coId]
    );
    const row = rows[0];
    if (!row) return null;

    return {
        co_id: String(row.co_id ?? ''),
        co_subject: String(row.co_subject ?? ''),
        co_content: String(row.co_content ?? ''),
        co_html: Number(row.co_html ?? 0),
        co_skin: String(row.co_skin ?? ''),
        co_mobile_skin: String(row.co_mobile_skin ?? ''),
        co_tag_filter_use: Number(row.co_tag_filter_use ?? 0),
        co_hit: Number(row.co_hit ?? 0),
        co_include_head: String(row.co_include_head ?? ''),
        co_include_tail: String(row.co_include_tail ?? '')
    };
}

/** g5_config에서 사이트 제목 조회 (변수 치환용) */
export async function getSiteTitle(): Promise<string> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT cf_title FROM g5_config LIMIT 1');
    if (rows[0]) {
        return (rows[0] as { cf_title: string }).cf_title;
    }
    return env.VITE_SITE_NAME || '다모앙 - 종합 커뮤니티';
}

/** 컨텐츠 내 변수 치환 (PHP 호환) */
export function replaceContentVariables(content: string, siteTitle: string): string {
    return content
        .replace(/\{\{홈페이지제목\}\}/g, siteTitle)
        .replace(/\{\{사이트명\}\}/g, siteTitle);
}

/* ------------------------------------------------------------------ *
 * 콘텐츠 버전 관리 (g5_content_version)
 *
 * g5_content 는 "현재 활성본" 포인터로 유지되고, 모든 버전 스냅샷은
 * g5_content_version 에 보관된다. (테이블 DDL/데이터는 운영에서 수동 선반영)
 * ------------------------------------------------------------------ */

/** g5_content_version 단일 버전(전문 포함) */
export interface ContentVersion {
    id: number;
    co_id: string;
    version_no: number;
    effective_date: string;
    status: string;
    title: string;
    content: string;
    note: string;
    created_at: string;
}

/** g5_content_version 목록용 요약(전문 content 제외 — 페이로드 절감) */
export interface ContentVersionSummary {
    id: number;
    co_id: string;
    version_no: number;
    effective_date: string;
    status: string;
    title: string;
    note: string;
}

/**
 * 특정 co_id 의 공개 가능한 버전 목록(effective_date 내림차순).
 * draft 는 제외하고 active/archived/scheduled 만 반환한다.
 * content 전문은 목록에서 제외한다.
 */
export async function getContentVersions(coId: string): Promise<ContentVersionSummary[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, co_id, version_no,
                DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
                status, title, note
           FROM g5_content_version
          WHERE co_id = ? AND status IN ('active', 'archived', 'scheduled')
          ORDER BY effective_date DESC, version_no DESC`,
        [coId]
    );
    return rows.map((row) => ({
        id: Number(row.id ?? 0),
        co_id: String(row.co_id ?? ''),
        version_no: Number(row.version_no ?? 0),
        effective_date: String(row.effective_date ?? ''),
        status: String(row.status ?? ''),
        title: String(row.title ?? ''),
        note: String(row.note ?? '')
    }));
}

/**
 * 단일 버전 전문 조회. draft 는 반환하지 않는다(공개 라우트에서 404 처리).
 */
export async function getContentVersion(id: number): Promise<ContentVersion | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, co_id, version_no,
                DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
                status, title, content, note,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
           FROM g5_content_version
          WHERE id = ? AND status IN ('active', 'archived', 'scheduled')
          LIMIT 1`,
        [id]
    );
    const row = rows[0];
    if (!row) return null;

    return {
        id: Number(row.id ?? 0),
        co_id: String(row.co_id ?? ''),
        version_no: Number(row.version_no ?? 0),
        effective_date: String(row.effective_date ?? ''),
        status: String(row.status ?? ''),
        title: String(row.title ?? ''),
        content: String(row.content ?? ''),
        note: String(row.note ?? ''),
        created_at: String(row.created_at ?? '')
    };
}

/**
 * 가장 이른 미래 scheduled 버전 1건(예고용). 없으면 null.
 */
export async function getScheduledVersion(coId: string): Promise<ContentVersionSummary | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, co_id, version_no,
                DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
                status, title, note
           FROM g5_content_version
          WHERE co_id = ? AND status = 'scheduled' AND effective_date > CURDATE()
          ORDER BY effective_date ASC, version_no ASC
          LIMIT 1`,
        [coId]
    );
    const row = rows[0];
    if (!row) return null;

    return {
        id: Number(row.id ?? 0),
        co_id: String(row.co_id ?? ''),
        version_no: Number(row.version_no ?? 0),
        effective_date: String(row.effective_date ?? ''),
        status: String(row.status ?? ''),
        title: String(row.title ?? ''),
        note: String(row.note ?? '')
    };
}

/**
 * 지연 승격(lazy promote): 시행일이 도래한 scheduled 버전을 active 로 승격한다.
 *
 * - effective_date <= CURDATE() AND status='scheduled' 인 버전을 effective_date
 *   오름차순으로 순차 적용 → 기존 active 는 archived, 해당 버전은 active,
 *   g5_content(co_subject/co_content) 를 그 버전 내용으로 UPDATE.
 * - 트랜잭션으로 원자성 보장. 실패해도 읽기 흐름을 깨지 않도록 swallow.
 * - 1시간 가드로 매 요청 트랜잭션을 방지(모듈 스코프 Map).
 */
const promoteGuard = new Map<string, number>();
const PROMOTE_GUARD_MS = 60 * 60 * 1000; // 1시간

export async function promoteDuePolicyVersions(coId: string): Promise<void> {
    const now = Date.now();
    const last = promoteGuard.get(coId) ?? 0;
    if (now - last < PROMOTE_GUARD_MS) return;
    // 동시 요청이 모두 트랜잭션에 진입하지 않도록 실행 전 가드 설정
    promoteGuard.set(coId, now);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [dueRows] = await conn.query<RowDataPacket[]>(
            `SELECT id, title, content
               FROM g5_content_version
              WHERE co_id = ? AND status = 'scheduled' AND effective_date <= CURDATE()
              ORDER BY effective_date ASC, version_no ASC`,
            [coId]
        );

        if (dueRows.length === 0) {
            await conn.rollback();
            return;
        }

        for (const row of dueRows) {
            // 기존 active → archived
            await conn.query(
                `UPDATE g5_content_version
                    SET status = 'archived', updated_at = NOW()
                  WHERE co_id = ? AND status = 'active'`,
                [coId]
            );
            // 해당 scheduled → active
            await conn.query(
                `UPDATE g5_content_version
                    SET status = 'active', updated_at = NOW()
                  WHERE id = ?`,
                [row.id]
            );
            // g5_content 활성본 포인터 갱신
            await conn.query(
                `UPDATE g5_content
                    SET co_subject = ?, co_content = ?
                  WHERE co_id = ?`,
                [String(row.title ?? ''), String(row.content ?? ''), coId]
            );
        }

        await conn.commit();
    } catch (err) {
        try {
            await conn.rollback();
        } catch {
            /* rollback 실패는 무시 */
        }
        // 일시적 실패는 다음 요청에서 재시도할 수 있도록 가드 해제
        promoteGuard.delete(coId);
        console.error('[content] promoteDuePolicyVersions 실패:', err);
    } finally {
        conn.release();
    }
}
