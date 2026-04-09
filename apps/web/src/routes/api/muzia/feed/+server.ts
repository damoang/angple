import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/muzia/feed?per_page=20&tab=all|best|board */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const perPage = Math.min(30, parseInt(url.searchParams.get('per_page') || '20'));
        const tab = url.searchParams.get('tab') || 'all';

        const boards = ['qna', 'forum', 'music', 'sibelius', 'tip', 'notice', 'hello', 'violin', 'piano', 'sheet'];
        const allPosts: any[] = [];

        // 인기 게시글 (best 탭) vs 최신 게시글
        const orderBy = tab === 'best' ? 'wr_good DESC, wr_hit DESC' : 'wr_id DESC';
        const limit = tab === 'best' ? 3 : 5;

        for (const board of boards) {
            try {
                const [rows] = await pool.query(
                    `SELECT wr_id as id, wr_subject as title, wr_name as author, mb_id as author_id,
                            wr_datetime as created_at, wr_hit as views, wr_good as likes,
                            wr_comment as comments_count, LEFT(wr_content, 300) as raw_content,
                            wr_link1 as link1, ? as board_id
                     FROM g5_write_${board} WHERE wr_is_comment = 0 ORDER BY ${orderBy} LIMIT ?`,
                    [board, limit]
                ) as any;
                allPosts.push(...rows);
            } catch {}
        }

        // 게시판 이름
        const [boardNames] = await pool.query(
            'SELECT bo_table, bo_subject FROM g5_board WHERE bo_table IN (?)', [boards]
        ) as any;
        const nameMap: Record<string, string> = {};
        for (const b of boardNames) nameMap[b.bo_table] = b.bo_subject;

        // 정렬
        if (tab === 'best') {
            allPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        } else {
            allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        // 이미지 추출 + 썸네일
        const topPosts = allPosts.slice(0, perPage);

        function extractImage(html: string): string | null {
            if (!html) return null;
            const match = html.match(/src=["']([^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)/i);
            if (match) {
                let url = match[1];
                if (url.startsWith('http://muzia.net')) url = url.replace('http://', 'https://');
                return url;
            }
            return null;
        }

        function extractYouTubeId(content: string, link1: string): string | null {
            const sources = [content || '', link1 || ''];
            for (const src of sources) {
                const m = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                if (m) return m[1];
            }
            return null;
        }

        // 첨부파일 썸네일
        const thumbnails: Record<string, string> = {};
        for (const p of topPosts) {
            try {
                const [files] = await pool.query(
                    'SELECT bf_file FROM g5_board_file WHERE bo_table = ? AND wr_id = ? AND (bf_file LIKE "%.jpg" OR bf_file LIKE "%.jpeg" OR bf_file LIKE "%.png" OR bf_file LIKE "%.gif" OR bf_file LIKE "%.webp") LIMIT 1',
                    [p.board_id, p.id]
                ) as any;
                if (files.length > 0) {
                    thumbnails[`${p.board_id}-${p.id}`] = `https://muzia.net/data/file/${p.board_id}/${files[0].bf_file}`;
                }
            } catch {}
        }

        const result = topPosts.map(p => {
            const key = `${p.board_id}-${p.id}`;
            const contentImg = extractImage(p.raw_content);
            const ytId = extractYouTubeId(p.raw_content, p.link1);
            const image = thumbnails[key] || contentImg || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

            return {
                id: p.id,
                board_id: p.board_id,
                board_name: nameMap[p.board_id] || p.board_id,
                title: p.title,
                author: p.author,
                author_id: p.author_id,
                created_at: p.created_at,
                views: p.views,
                likes: p.likes,
                comments_count: p.comments_count,
                image,
                youtube_id: ytId,
                excerpt: (p.raw_content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 120),
            };
        });

        return json({ success: true, data: { posts: result } });
    } catch (error) {
        console.error('[Muzia Feed] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};
