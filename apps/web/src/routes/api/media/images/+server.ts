/**
 * POST /api/media/images — 파일 업로드 (AWS S3 또는 S3 호환 저장소)
 * 이미지 + 일반 파일 모두 지원
 * 인증: access_token / refresh_token / damoang_jwt 쿠키 (공유 인증)
 *
 * 저장 경로는 두 가지 모드가 있다 ($lib/server/media/s3-client 참고):
 * - AWS (기본): raw/ 에 올리면 Lambda 가 data/ 로 변환 + 썸네일 생성 + R2 dual-write
 * - 직접 업로드 (AWS 가 아닌 S3_ENDPOINT 지정 또는 S3_DIRECT_UPLOAD=true, 예: Cloudflare R2 단독 사이트):
 *   Lambda 가 없으므로 data/ 최종 키에 바로 저장하고 변환 대기를 건너뛴다
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getAuthUser, verifyToken } from '$lib/server/auth/index.js';
import crypto from 'node:crypto';
import {
    s3,
    S3_BUCKET,
    S3_REGION,
    S3_DIRECT_UPLOAD,
    CDN_BASE
} from '$lib/server/media/s3-client.js';
import {
    DEFAULT_PROCESS_WAIT_MS,
    processWaitMs,
    rawKeyToFinalKey
} from '$lib/server/media/final-key.js';

const ALLOWED_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.heic',
    '.heif',
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
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_GIF_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_SIZE = 40 * 1024 * 1024; // 40MB

function isImageExt(ext: string): boolean {
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.heif'].includes(ext);
}

function isVideoExt(ext: string): boolean {
    return ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.m4v'].includes(ext);
}

function getExt(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

/**
 * MIME 타입 → 표준 확장자.
 *
 * 에디터 내에서 이미지를 드래그하면 브라우저가 파일명을 `download`(확장자 없음)로 주는데,
 * `file.type`(예: image/png)은 유효하다. 확장자 검증만 하면 이런 파일이 거부되므로
 * (bug/13471), 확장자가 없거나 미허용일 때 MIME 으로 확장자를 복구한다. 지원 MIME 이
 * 아니면 '' 를 반환해 호출부가 400 을 유지하도록 한다.
 */
function mimeToExt(mime: string): string {
    switch ((mime || '').split(';')[0].trim().toLowerCase()) {
        case 'image/jpeg':
        case 'image/jpg':
            return '.jpg';
        case 'image/png':
            return '.png';
        case 'image/gif':
            return '.gif';
        case 'image/webp':
            return '.webp';
        case 'image/svg+xml':
            return '.svg';
        case 'image/heic':
            return '.heic';
        case 'image/heif':
            return '.heif';
        case 'video/mp4':
            return '.mp4';
        case 'video/webm':
            return '.webm';
        case 'video/quicktime':
            return '.mov';
        case 'video/x-msvideo':
            return '.avi';
        case 'video/x-matroska':
            return '.mkv';
        default:
            return '';
    }
}

function sanitize(filename: string): string {
    const ext = getExt(filename);
    const base = filename
        .slice(0, filename.length - ext.length)
        .replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    return (base || 'file') + ext;
}

function generateKey(ext: string): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    // 7자리 해시 (PHP S3Uploader와 동일 방식)
    const hash = crypto
        .createHash('md5')
        .update(Date.now().toString() + Math.random().toString())
        .digest('hex')
        .slice(0, 7);
    // raw/ 경로로 업로드 → Lambda S3 이벤트 트리거 → data/ 경로로 변환 + 썸네일 생성
    return `raw/editor/${yy}${mm}/${hash}${ext}`;
}

/** 조회 한 번의 한도 — 걸린 조회가 전체 대기를 끌고 가지 않게 한다 */
const HEAD_TIMEOUT_MS = 3000;

/**
 * Lambda 변환 완료 대기 — data/ 키에 HeadObject 폴링.
 * 기본 한도(8초)는 300ms 간격, 그보다 긴 대기(재인코딩 영상)는 1초 간격으로 묻는다.
 *
 * 한도는 시도 횟수가 아니라 **시각**으로 끊는다. 조회 한 번이 느려져도 전체 대기가
 * 한도를 넘지 않아야 앞단 프록시의 응답 대기 제한에 걸리지 않는다.
 */
async function waitForProcessed(
    finalKey: string,
    maxWaitMs = DEFAULT_PROCESS_WAIT_MS,
    intervalMs = maxWaitMs > DEFAULT_PROCESS_WAIT_MS ? 1000 : 300
): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        try {
            await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: finalKey }), {
                abortSignal: AbortSignal.timeout(Math.min(HEAD_TIMEOUT_MS, remaining))
            });
            return true;
        } catch {
            // 아직 변환 안 됨(또는 조회 지연) — 남은 시간이 있으면 대기 후 재시도
        }
        if (deadline - Date.now() <= intervalMs) return false;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
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
    // 동영상 업로드 시 브라우저가 캡처한 포스터(첫 프레임 jpg) — 옵션, 없으면 현행과 동일
    const poster = formData.get('poster');

    if (!file || !(file instanceof File)) {
        error(400, '파일이 필요합니다.');
    }

    // 형식 검증: 확장자 우선, 없거나 미허용이면 MIME 으로 복구(bug/13471: 에디터에서
    // 드래그한 이미지는 파일명이 `download`(확장자 없음)이지만 file.type 은 유효하다).
    const rawExt = getExt(file.name);
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : mimeToExt(file.type);
    if (!ext) {
        error(400, `지원하지 않는 파일 형식입니다: ${rawExt || file.type || file.name}`);
    }

    // 크기 검증
    const sizeLimit =
        ext === '.gif'
            ? MAX_GIF_SIZE
            : isImageExt(ext)
              ? MAX_IMAGE_SIZE
              : isVideoExt(ext)
                ? MAX_VIDEO_SIZE
                : MAX_SIZE;
    if (file.size > sizeLimit) {
        error(400, `파일 크기가 너무 큽니다 (최대 ${Math.floor(sizeLimit / 1024 / 1024)}MB)`);
    }

    const rawKey = generateKey(ext);
    // 변환 파이프라인은 .mov 등을 mp4 로 바꿔 저장한다 — 최종 키도 그 이름이어야 한다.
    // 직접 업로드 모드는 변환이 없으므로 올린 확장자 그대로다.
    const keyOptions = { converted: !S3_DIRECT_UPLOAD };
    const finalKey = rawKeyToFinalKey(rawKey, keyOptions);
    const contentType = file.type || 'application/octet-stream';

    // 포스터는 동영상에 한해, jpeg·2MB 이하만 수용 (남용 방지). 관례 키 = 동영상과
    // 같은 해시의 형제 키(…/{hash}_poster.jpg). raw/ 로 올려 기존 Lambda 파이프라인
    // (data/ 변환 + R2 dual-write)을 그대로 태운다 — data/ 직행 시 R2 에 실리지 않음.
    const hasPoster =
        poster instanceof File &&
        isVideoExt(ext) &&
        poster.type === 'image/jpeg' &&
        poster.size > 0 &&
        poster.size <= 2 * 1024 * 1024;
    const posterRawKey = hasPoster ? rawKey.replace(/\.[a-z0-9]+$/i, '_poster.jpg') : null;
    const posterFinalKey = posterRawKey ? rawKeyToFinalKey(posterRawKey, keyOptions) : null;

    // 직접 업로드 모드는 Lambda 가 없으므로 최종 키(data/)에 바로 저장한다
    const uploadKey = S3_DIRECT_UPLOAD ? finalKey : rawKey;
    const posterUploadKey = S3_DIRECT_UPLOAD ? posterFinalKey : posterRawKey;

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        await s3.send(
            new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: uploadKey,
                Body: buffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable'
            })
        );

        if (hasPoster && posterUploadKey) {
            const posterBuffer = Buffer.from(await (poster as File).arrayBuffer());
            await s3.send(
                new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: posterUploadKey,
                    Body: posterBuffer,
                    ContentType: 'image/jpeg',
                    CacheControl: 'public, max-age=31536000, immutable'
                })
            );
        }

        // Lambda 변환 완료 대기 — race condition 방지 (포스터는 소형이라 본 파일보다 먼저 끝남)
        // 직접 업로드 모드는 이미 최종 키에 저장됐으므로 대기하지 않는다
        const [isReady, posterReady] = S3_DIRECT_UPLOAD
            ? [true, Boolean(hasPoster && posterFinalKey)]
            : await Promise.all([
                  // 재인코딩되는 영상은 더 오래 기다린다 — 아직 없는 주소를 돌려주지 않기 위함
                  waitForProcessed(finalKey, processWaitMs(rawKey, keyOptions)),
                  posterFinalKey ? waitForProcessed(posterFinalKey) : Promise.resolve(false)
              ]);
        if (!isReady) {
            console.warn(
                `[media/images] Lambda processing not confirmed within timeout: ${finalKey}`
            );
        }

        // Lambda가 raw/ → data/ 변환 후 최종 URL (직접 업로드 모드는 CDN URL 이 곧 원본 URL)
        const cdnUrl = `${CDN_BASE}/${finalKey}`;
        const originUrl = S3_DIRECT_UPLOAD
            ? cdnUrl
            : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${finalKey}`;

        return json({
            success: true,
            data: {
                key: finalKey,
                url: cdnUrl,
                cdn_url: cdnUrl,
                origin_url: originUrl,
                filename: file.name,
                content_type: contentType,
                size: file.size,
                // 포스터가 실제 준비됐을 때만 내려보냄 — 404 포스터 URL 을 본문에 박제하지 않기 위함
                ...(posterReady && posterFinalKey
                    ? { poster_url: `${CDN_BASE}/${posterFinalKey}` }
                    : {})
            }
        });
    } catch (err) {
        // 에러 종류(AccessDenied, NoSuchBucket, CredentialsProviderError …)를 남겨
        // 자격증명/버킷 설정 문제를 로그에서 바로 식별할 수 있게 한다
        const name = err instanceof Error ? err.name : 'Error';
        console.error(
            `[media/images] S3 upload failed (${name}) bucket=${S3_BUCKET} key=${uploadKey} member=${memberId}:`,
            err
        );
        error(500, `파일 업로드에 실패했습니다. (${name})`);
    }
};
