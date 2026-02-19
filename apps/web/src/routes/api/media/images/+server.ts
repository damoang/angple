/**
 * POST /api/media/images — 파일 업로드 (S3, EC2 IAM Role 인증)
 * 이미지 + 일반 파일 모두 지원
 * 인증: damoang_jwt 쿠키 (HMAC JWT)
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { jwtVerify } from 'jose';

const S3_REGION = process.env.S3_REGION || 'ap-northeast-2';
const S3_BUCKET = process.env.S3_BUCKET || 'damoang-data-v1';
const CDN_BASE = 'https://s3.damoang.net';
const JWT_SECRET = new TextEncoder().encode(
    process.env.DAMOANG_JWT_SECRET || '.damoang.net-jwt-secret'
);

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
    const safe = sanitize(filename);
    return `data/editor/${yy}${mm}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}_${safe}`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    // 인증 확인 (damoang_jwt 쿠키 JWT 검증)
    const token = cookies.get('damoang_jwt');
    if (!token) {
        error(401, '로그인이 필요합니다.');
    }

    let memberId: string;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        // damoang.net 형식: mb_id, angple-backend 형식: user_id
        memberId = (payload.mb_id as string) || (payload.user_id as string) || '';
        if (!memberId) {
            error(401, '유효하지 않은 인증 정보입니다.');
        }
    } catch {
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

    const key = generateKey(file.name);
    const contentType = file.type || 'application/octet-stream';

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        await s3.send(
            new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000'
            })
        );

        const cdnUrl = `${CDN_BASE}/${key}`;

        return json({
            success: true,
            data: {
                key,
                url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
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
