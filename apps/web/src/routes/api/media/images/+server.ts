/**
 * POST /api/media/images — 파일 업로드 (S3, EC2 IAM Role 인증)
 * 이미지 + 일반 파일 모두 지원
 * 인증: access_token / refresh_token / damoang_jwt 쿠키 (공유 인증)
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getAuthUser, verifyToken } from '$lib/server/auth/index.js';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

const S3_REGION = env.S3_REGION || 'ap-northeast-2';
const S3_BUCKET = env.S3_BUCKET || 'damoang-data-v1';
const CDN_BASE = (env.CDN_URL || env.VITE_S3_URL || 'https://s3.damoang.net').replace(/\/$/, '');

// S3 클라이언트 (EC2 IAM Role 자동 인증)
const s3 = new S3Client({ region: S3_REGION });

const ALLOWED_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
    '.wmv',
    '.flv',
    '.m4v',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.gz',
    '.txt',
    '.csv',
    '.json'
]);
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function getExt(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function sanitize(filename: string): string {
    const ext = getExt(filename);
    const base = filename
        .slice(0, filename.length - ext.length)
        .replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    return (base || 'file') + ext;
}

function generateKey(filename: string): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const ext = getExt(filename);
    // 7자리 해시 (PHP S3Uploader와 동일 방식)
    const hash = crypto.createHash('md5').update(Date.now().toString() + Math.random().toString()).digest('hex').slice(0, 7);
    // raw/ 경로로 업로드 → Lambda S3 이벤트 트리거 → data/ 경로로 변환 + 썸네일 생성
    return `raw/editor/${yy}${mm}/${hash}${ext}`;
}

/** raw/editor/... → data/editor/... 경로 변환 (Lambda 처리 후 최종 URL) */
function rawKeyToFinalKey(rawKey: string): string {
    return rawKey.replace(/^raw\//, 'data/');
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    // 인증 확인: 1) Authorization 헤더 2) 쿠키 (access_token / refresh_token / damoang_jwt)
    let memberId = '';

    // 1순위: Authorization Bearer 토큰
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = await verifyToken(token);
        if (payload?.sub) {
            memberId = payload.sub;
        }
    }

    // 2순위: 쿠키 기반 인증
    if (!memberId) {
        const authUser = await getAuthUser(cookies);
        if (authUser) {
            memberId = authUser.mb_id;
        }
    }

    if (!memberId) {
        error(401, '로그인이 필요합니다.');
    }

    // multipart form data 파싱
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
        error(400, '파일이 필요합니다.');
    }

    // 확장자 검증
    const ext = getExt(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        error(400, `지원하지 않는 파일 형식입니다: ${ext}`);
    }

    // 크기 검증
    if (file.size > MAX_SIZE) {
        error(400, `파일 크기가 너무 큽니다 (최대 ${MAX_SIZE / 1024 / 1024}MB)`);
    }

    const rawKey = generateKey(file.name);
    const finalKey = rawKeyToFinalKey(rawKey);
    const contentType = file.type || 'application/octet-stream';

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        await s3.send(
            new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: rawKey,
                Body: buffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000'
            })
        );

        // Lambda가 raw/ → data/ 변환 후 최종 URL
        const cdnUrl = `${CDN_BASE}/${finalKey}`;

        return json({
            success: true,
            data: {
                key: finalKey,
                url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${finalKey}`,
                cdn_url: cdnUrl,
                filename: file.name,
                content_type: contentType,
                size: file.size
            }
        });
    } catch (err) {
        console.error('[media/images] S3 upload failed:', err);
        error(500, '파일 업로드에 실패했습니다.');
    }
};
