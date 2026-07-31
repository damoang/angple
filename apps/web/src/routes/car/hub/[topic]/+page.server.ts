/**
 * 자동차 주제 허브 (SEO L0 파일럿) — /car/hub/{topic}
 * 설계: docs/seo-niche-hub-design-20260731.html
 *
 * 커뮤니티는 개별 글을 못 고친다(사용자 작성). 그래서 흩어진 대화체 글을
 * 주제 허브로 묶어, 허브가 정보 키워드로 랭킹을 잡게 한다.
 * 이 서버 로더는 화이트리스트 주제의 g5_write_car 글을 제목 매칭으로 모은다.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { findCarHubTopic } from '$lib/server/car-hub-topics';

const MIN_POSTS = 3; // thin content 방지: 글 3개 미만 주제는 404
const LIST_LIMIT = 40;

interface CarPostRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    wr_name: string;
    wr_datetime: string;
    wr_hit: number;
    wr_comment: number;
    wr_good: number;
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
    const topic = findCarHubTopic(params.topic);
    if (!topic) throw error(404, '존재하지 않는 자동차 주제입니다.');

    // 제목에 키워드 중 하나라도 포함된 글. 삭제·비밀글 제외.
    // g5_write_car 는 1.1만 행으로 작아 LIKE 스캔이 저렴하고, 아래 CDN 캐시로 재요청은 흡수된다.
    const likeClauses = topic.keywords.map(() => 'wr_subject LIKE ?').join(' OR ');
    const likeParams = topic.keywords.map((k) => `%${k}%`);

    let rows: CarPostRow[] = [];
    try {
        const [result] = await pool.query<CarPostRow[]>(
            `SELECT wr_id, wr_subject, wr_name, wr_datetime, wr_hit, wr_comment, wr_good
               FROM g5_write_car
              WHERE wr_is_comment = 0
                AND wr_deleted_at IS NULL
                AND (wr_option IS NULL OR wr_option NOT LIKE '%secret%')
                AND (${likeClauses})
              ORDER BY wr_datetime DESC
              LIMIT ?`,
            [...likeParams, LIST_LIMIT]
        );
        rows = result;
    } catch (e) {
        console.error('[car-hub] query 실패:', e);
        throw error(500, '주제 글을 불러오지 못했습니다.');
    }

    if (rows.length < MIN_POSTS) {
        // 아직 글이 얕은 주제는 허브를 만들지 않는다(thin page 페널티 회피).
        throw error(404, '아직 준비 중인 주제입니다.');
    }

    // 개인화 없음 → 공개 캐시. 크롤러·재방문 부하를 CDN 이 흡수한다.
    setHeaders({ 'cache-control': 'public, s-maxage=600, max-age=120' });

    return {
        topic,
        posts: rows.map((r) => ({
            id: r.wr_id,
            subject: r.wr_subject,
            author: r.wr_name,
            datetime: r.wr_datetime,
            hit: r.wr_hit ?? 0,
            comments: r.wr_comment ?? 0,
            good: r.wr_good ?? 0
        }))
    };
};
