/**
 * FAQ 데이터 조회 (g5_faq_master, g5_faq)
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

export interface FaqCategory {
    fm_id: number;
    fm_subject: string;
}

export interface FaqItem {
    fa_id: number;
    fm_id: number;
    fa_subject: string;
    fa_content: string;
}

/** FAQ 카테고리 목록 */
export async function getFaqCategories(): Promise<FaqCategory[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT fm_id, fm_subject FROM g5_faq_master ORDER BY fm_order, fm_id'
    );
    return rows as FaqCategory[];
}

/** 카테고리별 FAQ 항목 */
export async function getFaqItems(fmId: number): Promise<FaqItem[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT fa_id, fm_id, fa_subject, fa_content FROM g5_faq WHERE fm_id = ? ORDER BY fa_order, fa_id',
        [fmId]
    );
    return rows as FaqItem[];
}

/** 전체 FAQ (카테고리 + 항목) */
export async function getAllFaq(): Promise<{ categories: FaqCategory[]; items: FaqItem[] }> {
    const categories = await getFaqCategories();

    if (categories.length === 0) {
        return { categories, items: [] };
    }

    // 모든 카테고리의 항목을 한번에 조회
    const fmIds = categories.map((c) => c.fm_id);
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT fa_id, fm_id, fa_subject, fa_content
		 FROM g5_faq
		 WHERE fm_id IN (${fmIds.map(() => '?').join(',')})
		 ORDER BY fa_order, fa_id`,
        fmIds
    );

    return { categories, items: rows as FaqItem[] };
}
