/**
 * 마음메시지 배너 API
 * 1차: celebration_banners 테이블 (신규 단일 소스)
 * 2차: g5_write_message 테이블 (레거시 fallback — 마이그레이션 전까지)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { normalizeMediaUrl } from '$lib/utils/media-url';

interface Banner {
    id: number;
    title: string;
    content: string;
    image_url: string;
    link_url: string;
    display_date: string;
    is_active: boolean;
    target_member_id?: string;
    target_member_nick?: string;
    target_member_photo?: string;
    external_link?: string;
    link_target?: string;
    sort_order?: number;
    display_type: 'image' | 'text';
}

const CDN_BASE = (env.CDN_URL || env.VITE_S3_URL || 'https://s3.damoang.net').replace(/\/$/, '');

/**
 * KST(Asia/Seoul) 기준 오늘 YYYY-MM-DD.
 *
 * RDS time_zone=SYSTEM(UTC) 라 MySQL CURDATE()/NOW() 가 KST 새벽 0~9시 동안 어제
 * 날짜를 반환 → 마음메시지가 KST 자정~오전에 미표시되는 #12516 동일 원인.
 * `$lib/server/celebration.ts` 와 일치하는 KST 파라미터화 (#12516 fix).
 */
function getTodayKST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/**
 * 회원 프로필 이미지 URL 생성
 */
function getMemberPhotoUrl(mbImageUrl: string | null | undefined): string | undefined {
    if (!mbImageUrl) return undefined;
    if (mbImageUrl.startsWith('http://') || mbImageUrl.startsWith('https://')) {
        return mbImageUrl;
    }
    return `${CDN_BASE}/${mbImageUrl}`;
}

/**
 * 본문에서 첫 번째 이미지 URL 추출 (g5_write_message 용)
 */
function extractFirstImage(content: string): string | null {
    if (!content) return null;
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
        // /data/ 상대경로 + s3/cdn 절대 URL 모두 CDN_BASE(r2) 로 정규화
        return normalizeMediaUrl(imgMatch[1], CDN_BASE);
    }
    return null;
}

export const GET: RequestHandler = async () => {
    try {
        const banners: Banner[] = [];

        // 1차: celebration_banners 테이블 (신규) — g5_member JOIN으로 닉네임/사진 가져옴
        // #12516: CURDATE() (RDS UTC) → KST today 파라미터화. yearly_repeat 도 KST 기준 MONTH/DAY 비교.
        const todayKST = getTodayKST(); // 'YYYY-MM-DD'
        try {
            const [rows] = await pool.execute<RowDataPacket[]>(
                `SELECT cb.id, cb.title, cb.content, cb.image_url, cb.link_url,
                        cb.external_url, cb.display_date, cb.target_member_id,
                        cb.link_target, cb.sort_order, cb.display_type,
                        cb.source_wr_id, cb.updated_at AS cb_updated_at, cb.is_anonymous,
                        m.mb_nick AS target_member_nick,
                        m.mb_image_url AS target_member_image_url,
                        wm.wr_content AS source_content,
                        wm.wr_name AS source_wr_name
                 FROM celebration_banners cb
                 LEFT JOIN g5_member m
                   ON cb.target_member_id COLLATE utf8mb4_unicode_ci = m.mb_id COLLATE utf8mb4_unicode_ci
                 LEFT JOIN g5_write_message wm
                   ON cb.source_wr_id = wm.wr_id AND wm.wr_is_comment = 0
                 WHERE cb.is_active = 1
                   AND (cb.display_date = ?
                        OR (cb.yearly_repeat = 1
                            AND MONTH(cb.display_date) = MONTH(?)
                            AND DAY(cb.display_date) = DAY(?)))
                 ORDER BY cb.sort_order ASC, cb.id DESC`,
                [todayKST, todayKST, todayKST]
            );

            for (const row of rows as RowDataPacket[]) {
                const linkUrl =
                    row.external_url ||
                    (row.source_wr_id ? `/message/${row.source_wr_id}` : row.link_url || '');
                const sourceWrName = (row.source_wr_name ?? '').toString().trim();
                const anonymous = !!row.is_anonymous || (!!row.source_wr_id && sourceWrName === '');

                // source_wr_id가 있으면 원본 게시글에서 최신 이미지 추출 (동기화)
                // DB 에 s3 host 로 저장된 배너 이미지도 CDN_URL(r2) 로 정규화
                let imageUrl = normalizeMediaUrl(row.image_url, CDN_BASE) ?? '';
                if (row.source_content) {
                    const freshImage = extractFirstImage(row.source_content);
                    if (freshImage) imageUrl = freshImage;
                }
                // 캐시버스팅: updated_at 타임스탬프 추가
                if (imageUrl) {
                    const ts = new Date(row.cb_updated_at || 0).getTime();
                    imageUrl += `${imageUrl.includes('?') ? '&' : '?'}t=${ts}`;
                }

                banners.push({
                    id: row.source_wr_id || row.id,
                    title: row.title,
                    content: row.content || '',
                    image_url: imageUrl,
                    link_url: linkUrl,
                    display_date: row.display_date,
                    is_active: true,
                    target_member_id: anonymous ? undefined : row.target_member_id || undefined,
                    target_member_nick: anonymous ? undefined : row.target_member_nick || undefined,
                    target_member_photo: anonymous
                        ? undefined
                        : getMemberPhotoUrl(row.target_member_image_url),
                    external_link: row.external_url || undefined,
                    link_target: row.link_target || '_blank',
                    sort_order: row.sort_order || 0,
                    display_type: row.display_type || 'image'
                });
            }
        } catch {
            // celebration_banners 테이블이 없을 수 있음 — 무시하고 fallback으로
        }

        // 2차: g5_write_message fallback (마이그레이션 전까지) — g5_member JOIN
        // #12516: NOW() (RDS UTC) 대신 KST today 4종 포맷을 파라미터로.
        if (banners.length === 0) {
            const [yStr, mStr, dStr] = todayKST.split('-');
            const mNum = String(Number(mStr));
            const dNum = String(Number(dStr));
            const legacyFormats = [
                `${yStr}.${mStr}.${dStr}`,
                todayKST,
                `${yStr}.${mNum}.${dNum}`,
                `${yStr}-${mNum}-${dNum}`
            ];
            const [rows] = await pool.execute<RowDataPacket[]>(
                `SELECT wm.wr_id, wm.wr_subject, wm.wr_content, wm.wr_link2, wm.mb_id,
                        wm.wr_name, m.mb_nick, m.mb_image_url
                 FROM g5_write_message wm
                 LEFT JOIN g5_member m ON wm.mb_id = m.mb_id
                 WHERE wm.wr_is_comment = 0
                   AND wm.wr_subject IN (?, ?, ?, ?)
                 ORDER BY wm.wr_id DESC`,
                legacyFormats
            );

            for (const row of rows as RowDataPacket[]) {
                const imageUrl = extractFirstImage(row.wr_content);
                if (imageUrl) {
                    const anonymous = (row.wr_name ?? '').toString().trim() === '';
                    banners.push({
                        id: row.wr_id,
                        title: row.wr_subject,
                        content: row.wr_content,
                        image_url: imageUrl,
                        link_url: `/message/${row.wr_id}`,
                        display_date: row.wr_subject,
                        is_active: true,
                        target_member_id: anonymous ? undefined : row.mb_id || undefined,
                        target_member_nick: anonymous ? undefined : row.mb_nick || undefined,
                        target_member_photo: anonymous
                            ? undefined
                            : getMemberPhotoUrl(row.mb_image_url),
                        external_link: row.wr_link2 || undefined,
                        display_type: 'image'
                    });
                }
            }
        }

        return json(
            { success: true, data: banners },
            { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
        );
    } catch (error) {
        console.error('Banner API error:', error);
        return json(
            {
                success: false,
                data: [],
                error: 'Failed to fetch banners'
            },
            { status: 500 }
        );
    }
};
