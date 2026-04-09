import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/server/db/auth';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// 그누보드 data 디렉토리 (Docker 볼륨 마운트)
const GNUBOARD_DATA = process.env.GNUBOARD_DATA_PATH || '/app/gnuboard-data';

/** POST /api/muzia/upload — 댓글/게시글 이미지 업로드 */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) return json({ success: false, error: '파일 없음' }, { status: 400 });

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
            return json({ success: false, error: '이미지 파일만 가능' }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
            return json({ success: false, error: '10MB 이하만 가능' }, { status: 400 });
        }

        // 경로: /data/editor/YYMM/cmt_timestamp_random_hash.ext (그누보드 호환)
        const now = new Date();
        const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const hash = randomBytes(16).toString('hex');
        const filename = `cmt_${Math.floor(now.getTime() / 1000)}_${randomBytes(4).toString('hex')}_${hash.slice(0, 32)}.${ext}`;

        const dir = join(GNUBOARD_DATA, 'editor', ym);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        writeFileSync(join(dir, filename), buffer);

        // URL: 프록시 경유 (NPM이 /data/ → newcomposer-nginx로 전달)
        const url = `https://muzia.net/data/editor/${ym}/${filename}`;

        return json({ success: true, data: { url, filename, size: file.size } });
    } catch (error) {
        console.error('[Upload] error:', error);
        return json({ success: false, error: '업로드 실패' }, { status: 500 });
    }
};
