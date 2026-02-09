/**
 * g5_content 테이블 조회 헬퍼
 * 정적 페이지(이용약관, 개인정보처리방침 등) 로드
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

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
	return (rows[0] as ContentRow) || null;
}

/** g5_config에서 사이트 제목 조회 (변수 치환용) */
export async function getSiteTitle(): Promise<string> {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT cf_title FROM g5_config LIMIT 1"
	);
	if (rows[0]) {
		return (rows[0] as { cf_title: string }).cf_title;
	}
	return '다모앙';
}

/** 컨텐츠 내 변수 치환 (PHP 호환) */
export function replaceContentVariables(content: string, siteTitle: string): string {
	return content
		.replace(/\{\{홈페이지제목\}\}/g, siteTitle)
		.replace(/\{\{사이트명\}\}/g, siteTitle);
}
