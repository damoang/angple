import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';
import { getConnection } from '$lib/server/db/mysql';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = '/app/gnuboard-data/editor';

/** POST /api/v2/boards/[boardId]/upload/image — 에디터 이미지 업로드 (muzia 전용) */
export const POST: RequestHandler = async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인 필요' } }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file || !file.size) {
            return json({ success: false, error: { code: 'BAD_REQUEST', message: '파일이 없습니다' } }, { status: 400 });
        }

        // 이미지 타입 확인
        if (!file.type.startsWith('image/')) {
            return json({ success: false, error: { code: 'BAD_REQUEST', message: '이미지 파일만 업로드 가능합니다' } }, { status: 400 });
        }

        // 파일 저장
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const dateDir = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
        const fileName = `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const dirPath = path.join(UPLOAD_DIR, dateDir);
        const filePath = path.join(dirPath, fileName);

        // 디렉토리 생성
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // 파일 쓰기
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        const url = `https://muzia.net/data/editor/${dateDir}/${fileName}`;

        return json({
            success: true,
            data: {
                url,
                filename: fileName,
                size: file.size,
                type: file.type
            }
        });
    } catch (error) {
        console.error('[Upload Image] error:', error);
        return json({ success: false, error: { code: 'SERVER_ERROR', message: '업로드 실패' } }, { status: 500 });
    }
};
