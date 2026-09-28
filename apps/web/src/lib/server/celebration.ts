/**
 * 마음메시지 조회 공유 모듈
 *
 * +layout.server.ts (SSR), /api/init, /api/ads/celebration/today 에서 공유.
 * 서버 사이드 60초 인메모리 캐시 포함.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { createCache } from '$lib/server/cache';
import { env } from '$env/dynamic/private';
import { normalizeMediaUrl } from '$lib/utils/media-url';

export interface CelebrationBanner {
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

function getMemberPhotoUrl(mbImageUrl: string | null | undefined): string | undefined {
    return normalizeMediaUrl(mbImageUrl, CDN_BASE) ?? undefined;
}

function extractFirstImage(content: string): string | null {
    if (!content) return null;
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
        return normalizeMediaUrl(imgMatch[1], CDN_BASE);
    }
    return null;
}

/**
 * 마음메시지 이미지 URL 정본 빌더.
 *
 * ⛔ SSR(+layout.server.ts)과 API(/api/ads/celebration/today)가 **반드시 같은 문자열**을 내야 한다.
 *    한 글자라도 다르면 브라우저는 다른 리소스로 보고 같은 파일을 두 번 받는다.
 *    2026-09-28: SSR 은 `r2…/x.webp`, API 는 `cdn…/x.webp?t=…` 를 내보내
 *    메인 LCP p75 가 1,104 → 1,931ms(+75%) 가 되었다(ETag 동일, 같은 파일).
 *
 * ⚠️ 정확히 적어 둔다 — 이 함수 하나만으로 「같은 문자열」이 보장되지는 **않는다.**
 *    이 함수는 `CDN_BASE`(= cdn host) 기준 URL 을 만들고, SSR 쪽은 그 뒤 hooks.server.ts 의
 *    `rewriteCdnToR2` 가 **HTML 응답에만** cdn→r2 로 바꾼다(JSON 응답은 안 바꾼다).
 *    따라서 HTML=`r2…?t=N`, API JSON=`cdn…?t=N` 으로 **여전히 호스트가 다르다.**
 *    지금 두 번 받지 않는 이유는 클라이언트가 첫 로드에 API 를 **부르지 않기** 때문이다
 *    (stores/celebration.svelte.ts initFromData 가 시드로 확정한다).
 *    🔴 그러므로 그 재요청을 되살리면 이 버그가 **조용히 복귀한다.** 되살리려면
 *    JSON 응답에도 같은 rewrite 를 적용하거나 이 함수가 최종 호스트까지 확정해야 한다.
 *
 * 순서가 의미를 갖는다:
 *   1) DB 값을 CDN_BASE 로 정규화 (s3 host 잔존 보정)
 *   2) 원본 글이 있으면 그 글의 첫 이미지로 **교체** — 회원이 이미지를 바꾼 경우 최신을 쓴다
 *   3) updated_at 기반 캐시버스터 부착 — 같은 경로로 이미지가 교체돼도 갱신되게
 *
 * ⚠️ 이 함수를 우회해 image_url 을 직접 만들지 마라. 그래서 이 버그가 생겼다.
 */
export function buildCelebrationImageUrl(
    dbImageUrl: unknown,
    sourceContent: unknown,
    updatedAt: unknown
): string {
    let imageUrl = normalizeMediaUrl(dbImageUrl as string | null | undefined, CDN_BASE) ?? '';
    if (sourceContent) {
        const freshImage = extractFirstImage(String(sourceContent));
        if (freshImage) imageUrl = freshImage;
    }
    if (imageUrl) {
        const ts = new Date((updatedAt as string | Date | null) || 0).getTime();
        // NaN 이면 붙이지 않는다 — `?t=NaN` 은 SSR/API 가 갈릴 여지를 다시 만든다.
        if (Number.isFinite(ts)) {
            imageUrl += `${imageUrl.includes('?') ? '&' : '?'}t=${ts}`;
        }
    }
    return imageUrl;
}

/**
 * KST(Asia/Seoul) 기준 오늘 YYYY-MM-DD.
 *
 * RDS time_zone=SYSTEM (UTC) 이라 MySQL CURDATE()/NOW() 가 KST 새벽 0~9시 동안
 * 어제 날짜를 반환 → 마음메시지가 KST 자정~오전에 미표시되는 #12516 의 원인.
 * 모든 today 비교는 이 함수 결과를 파라미터로 넘긴다.
 */
function getTodayKST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

const celebrationCache = createCache<CelebrationBanner[]>({ ttl: 60_000, maxSize: 10 });

/**
 * 마음메시지 조회
 * @param isRecent true면 날짜 무관 최근 8건, false면 오늘만
 */
export async function fetchCelebrations(isRecent: boolean = false): Promise<CelebrationBanner[]> {
    const banners: CelebrationBanner[] = [];

    // 1차: celebration_banners 테이블 (신규)
    try {
        // #12516: CURDATE() (RDS UTC) → KST today 파라미터화.
        const todayKST = getTodayKST();
        // ⛔ 2026-09-28: 이 질의는 /api/ads/celebration/today 가 자기 사본을 따로 갖고 있었고
        //    네 곳이 어긋나 있었다 — yearly_repeat 누락 · updated_at(캐시버스터) 누락 ·
        //    원본 글 최신 이미지 미반영 · ORDER BY 상이.
        //    그래서 SSR 과 API 가 **같은 이미지를 다른 URL 로** 내보내 브라우저가 두 번 받았고,
        //    메인 LCP p75 가 1,104 → 1,931ms(+75%) 가 되었다.
        //    ⭐ 이 모듈이 정본이다. API 는 getCachedCelebrations() 를 쓴다 — 사본을 만들지 마라.
        const dateFilter = isRecent
            ? ''
            : `AND (cb.display_date = ?
                    OR (cb.yearly_repeat = 1
                        AND MONTH(cb.display_date) = MONTH(?)
                        AND DAY(cb.display_date) = DAY(?)))`;
        const dateParams = isRecent ? [] : [todayKST, todayKST, todayKST];
        // ORDER BY 는 경로별로 다르다.
        //  · isRecent(최근 8건): 여러 날짜가 섞이므로 display_date DESC 가 의미를 갖는다(기존 유지).
        //  · 오늘치: 정본을 API 와 맞춘다(sort_order ASC, id DESC). yearly_repeat 행은
        //    display_date 가 과거라, display_date DESC 를 쓰면 올해 행이 먼저 와 순서가 흔들린다.
        const orderBy = isRecent
            ? 'cb.display_date DESC, cb.sort_order ASC, cb.id DESC'
            : 'cb.sort_order ASC, cb.id DESC';
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT cb.id, cb.title, cb.content, cb.image_url, cb.link_url,
					cb.external_url, cb.display_date, cb.target_member_id,
					cb.is_anonymous, cb.updated_at AS cb_updated_at,
					cb.link_target, cb.sort_order, cb.display_type,
					cb.source_wr_id,
					m.mb_nick AS target_member_nick,
					m.mb_image_url AS target_member_image_url,
					wm.wr_name AS source_wr_name,
					wm.wr_content AS source_content
			 FROM celebration_banners cb
			 LEFT JOIN g5_member m
			   ON cb.target_member_id COLLATE utf8mb4_unicode_ci = m.mb_id COLLATE utf8mb4_unicode_ci
			 LEFT JOIN g5_write_message wm
			   ON cb.source_wr_id = wm.wr_id AND wm.wr_is_comment = 0
			 WHERE cb.is_active = 1 ${dateFilter}
			 ORDER BY ${orderBy}
			 LIMIT 8`,
            dateParams
        );

        for (const row of rows as RowDataPacket[]) {
            const linkUrl =
                row.external_url ||
                row.link_url ||
                (row.source_wr_id ? `/message/${row.source_wr_id}` : '');
            const sourceWrName = (row.source_wr_name ?? '').toString().trim();
            const anonymous = !!row.is_anonymous || (!!row.source_wr_id && sourceWrName === '');

            banners.push({
                id: row.source_wr_id || row.id,
                title: row.title,
                content: row.content || '',
                image_url: buildCelebrationImageUrl(
                    row.image_url,
                    row.source_content,
                    row.cb_updated_at
                ),
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
    } catch (error) {
        // celebration_banners 테이블이 없을 수 있음
        console.error('fetchCelebrations error', error);
    }

    // 2차: g5_write_message fallback (마이그레이션 전까지)
    if (banners.length === 0) {
        try {
            // #12516: NOW() (RDS UTC) 대신 KST today 의 다양한 표기를 파라미터로.
            const todayKST = getTodayKST(); // 'YYYY-MM-DD'
            const [yStr, mStr, dStr] = todayKST.split('-');
            const mNum = String(Number(mStr));
            const dNum = String(Number(dStr));
            const legacyFormats = [
                `${yStr}.${mStr}.${dStr}`, // 2026.05.29
                todayKST, // 2026-05-29
                `${yStr}.${mNum}.${dNum}`, // 2026.5.29
                `${yStr}-${mNum}-${dNum}` // 2026-5-29
            ];
            const legacyDateFilter = isRecent ? '' : 'AND wm.wr_subject IN (?, ?, ?, ?)';
            const legacyParams = isRecent ? [] : legacyFormats;
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT wm.wr_id, wm.wr_subject, wm.wr_content, wm.wr_link2, wm.mb_id, wm.wr_name,
                        m.mb_nick, m.mb_image_url
                 FROM g5_write_message wm
                 LEFT JOIN g5_member m ON wm.mb_id = m.mb_id
                 WHERE wm.wr_is_comment = 0 ${legacyDateFilter}
                 ORDER BY wm.wr_id DESC
                 LIMIT 8`,
                legacyParams
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
                        link_url: row.wr_link2 || `/message/${row.wr_id}`,
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
        } catch (error) {
            console.error('fetchCelebrations fallback error', error);
        }
    }

    return banners;
}

/** 캐시된 마음메시지 조회 (60초 TTL, singleflight) */
export async function getCachedCelebrations(
    isRecent: boolean = false
): Promise<CelebrationBanner[]> {
    // #12516: 캐시키에 KST today 포함 — 자정 직후 60초 동안 어제 결과 노출 방지.
    const cacheKey = isRecent ? 'recent' : `today:${getTodayKST()}`;
    return celebrationCache.getOrSet(cacheKey, () => fetchCelebrations(isRecent));
}
