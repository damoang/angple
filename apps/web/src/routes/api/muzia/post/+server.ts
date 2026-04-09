import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/muzia/post?board=qna&id=9512 — 게시글 상세 + 댓글 (IP 포함, 댓글 ASC) */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const boardId = url.searchParams.get('board');
        const postId = url.searchParams.get('id');
        if (!boardId || !postId) return json({ success: false, error: 'board, id 필요' }, { status: 400 });

        const tableName = `g5_write_${boardId}`;

        // 게시글
        const [postRows] = await pool.query(
            'SELECT wr_id as id, wr_subject as title, wr_content as content, wr_name as author, mb_id as author_id, wr_datetime as created_at, wr_hit as views, wr_good as likes, wr_nogood as dislikes, wr_comment as comments_count, wr_ip as ip, wr_file as has_file, wr_link1 as link1, wr_link2 as link2 FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment = 0',
            [postId]
        ) as any;

        if (postRows.length === 0) {
            return json({ success: false, error: '게시글을 찾을 수 없습니다' }, { status: 404 });
        }

        const post = postRows[0];

        // 조회수 증가
        await pool.query('UPDATE `' + tableName + '` SET wr_hit = wr_hit + 1 WHERE wr_id = ?', [postId]);

        // 첨부파일
        const [files] = await pool.query(
            'SELECT bf_no, bf_file, bf_source, bf_filesize, bf_type, bf_datetime FROM g5_board_file WHERE bo_table = ? AND wr_id = ? ORDER BY bf_no',
            [boardId, postId]
        );

        // 댓글 (wr_comment, wr_comment_reply 순 — 대댓글이 부모 아래 위치)
        const [comments] = await pool.query(
            'SELECT wr_id as id, wr_parent as parent_id, wr_content as content, wr_name as author, mb_id as author_id, wr_datetime as created_at, wr_good as likes, wr_ip as ip, wr_comment, wr_comment_reply FROM `' + tableName + '` WHERE wr_parent = ? AND wr_is_comment > 0 ORDER BY wr_comment, wr_comment_reply',
            [postId]
        );

        return json({
            success: true,
            data: {
                post: {
                    ...post,
                    content: convertEmoji(post.content),
                    ip: maskIp(post.ip),
                    youtube_ids: extractYouTubeIds(post.content, post.link1, post.link2)
                },
                files,
                comments: (comments as any[]).map((c: any) => ({
                    ...c,
                    content: convertEmoji(c.content),
                    ip: maskIp(c.ip)
                }))
            }
        });
    } catch (error) {
        console.error('[Muzia Post] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

/** YouTube URL에서 비디오 ID 추출 (content + link1 + link2) */
function extractYouTubeIds(...sources: string[]): string[] {
    const ids: string[] = [];
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/g,
    ];
    for (const src of sources) {
        if (!src) continue;
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(src)) !== null) {
                if (!ids.includes(match[1])) ids.push(match[1]);
            }
        }
    }
    return ids;
}

/** {emo:filename.gif:size} → <img> 태그로 변환 */
function convertEmoji(content: string): string {
    if (!content) return '';
    return content.replace(/\{emo:([^:}]+):(\d+)\}/g, (_, file, size) => {
        return `<img src="https://muzia.net/nariya/skin/emo/${file}" alt="${file}" width="${size}" height="${size}" style="display:inline;vertical-align:middle;" />`;
    });
}

/** IP 마스킹: 123.456.789.012 → 123.456.*** */
function maskIp(ip: string): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.*`;
    }
    return ip.replace(/:[\da-f]+$/i, ':***');
}
