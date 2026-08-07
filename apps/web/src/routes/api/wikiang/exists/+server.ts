import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readPool } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

/**
 * 위키앙 문서 존재 배치 조회 (8/7 위키 연결 — 하이브리드 승인)
 *
 * GET ?titles=제목1|제목2  (최대 20개)
 * → { exists: string[] }   존재하는 제목만
 *
 * 본문·댓글의 나무위키 링크 옆에 「위키앙 문서 보기 / 작성하기」를 가르는 용도.
 * wikiang 은 같은 Angple 멀티사이트라 외부 API 없이 직조회한다
 * (wka_wiki.wikiang_pages — lib/server/wiki.ts 와 같은 저장소).
 *
 * ⚠️ 실패는 전부 fail-open(빈 배열) — 이 기능이 죽어도 화면은 그대로다.
 *    단 조용히 죽지 않게 5분에 한 번은 로그를 남긴다(조용한 실패 금지 원칙).
 */
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { exists: boolean; at: number }>();
let lastErrLogAt = 0;

export const GET: RequestHandler = async ({ url, setHeaders }) => {
    const raw = url.searchParams.get('titles') ?? '';
    const titles = [
        ...new Set(
            raw
                .split('|')
                .map((t) => t.trim())
                .filter((t) => t.length > 0 && t.length <= 255)
        )
    ].slice(0, 20);

    setHeaders({ 'Cache-Control': 'public, max-age=300' });
    if (titles.length === 0) return json({ exists: [] });

    const now = Date.now();
    const need: string[] = [];
    const found: string[] = [];
    for (const t of titles) {
        const c = cache.get(t);
        if (c && now - c.at < CACHE_TTL_MS) {
            if (c.exists) found.push(t);
        } else {
            need.push(t);
        }
    }

    if (need.length > 0) {
        try {
            const [rows] = await readPool.query<RowDataPacket[]>(
                // ⛔ DB 명시(wka_wiki.) 필수 — 이 라우트는 damoang 풀에서 돈다.
                // 존재 판정은 실문서로 한정한다(8/7 실측): 필터가 없으면 토론 사본·
                // 삭제 대기열·이미지 첨부 행만 있어도 「문서 보기」 배지가 켜진다
                // (예: title 'damoang' 은 /토론/damoang 한 건뿐, '이재명 정부' 는
                //  /위키앙_관리/삭제_예정/ 행으로도 존재). LIKE 의 _ 는 이스케이프.
                `SELECT title FROM wka_wiki.wikiang_pages
                 WHERE title IN (${need.map(() => '?').join(',')})
                   AND is_published = 1 AND is_private = 0
                   AND path NOT LIKE '/토론/%'
                   AND path NOT LIKE '/위키앙\\_관리/%'
                   AND path NOT LIKE '/파일/%'
                   AND path NOT LIKE '/틀/%'
                   AND title NOT REGEXP '\\\\.(jpe?g|png|gif|svg|webp|css|js)$'`,
                need
            );
            const hit = new Set(rows.map((r) => String(r.title)));
            for (const t of need) {
                const ok = hit.has(t);
                cache.set(t, { exists: ok, at: now });
                if (ok) found.push(t);
            }
        } catch (e) {
            if (now - lastErrLogAt > CACHE_TTL_MS) {
                lastErrLogAt = now;
                console.error('[wikiang/exists] 조회 실패 (fail-open):', e);
            }
            // fail-open: 이번 요청분은 미존재 취급(작성하기 링크로 표시됨)
        }
    }
    return json({ exists: found });
};
