/**
 * 미디어 업로드용 S3 호환 클라이언트 (AWS S3 또는 Cloudflare R2)
 *
 * /api/media/images 와 /health?deep=1 이 같은 설정을 공유한다.
 * 부팅 시 설정 요약을 한 줄 남겨, 저장소 설정 누락을 로그에서 바로 알아볼 수 있게 한다.
 * (2026-08 muzia.net: 저장소 미설정 상태로 운영되어 모든 이미지 업로드가 조용히 실패했던 사고 대응)
 */
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

export const S3_REGION = env.S3_REGION || 'ap-northeast-2';
export const S3_BUCKET = env.S3_BUCKET || 'damoang-data-v1';
export const S3_ENDPOINT = env.S3_ENDPOINT || '';
export const S3_DIRECT_UPLOAD = env.S3_DIRECT_UPLOAD === 'true' || Boolean(S3_ENDPOINT);
export const CDN_BASE = (env.CDN_URL || env.VITE_S3_URL || 'https://s3.damoang.net').replace(
    /\/$/,
    ''
);

const hasStaticCredentials = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

// endpoint 미지정 시 AWS 기본 endpoint/IAM Role을 사용하고, 지정 시 R2 같은 S3 호환 저장소를 사용한다.
export const s3 = new S3Client({
    region: S3_REGION,
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {})
});

console.log(
    `[media/s3] bucket=${S3_BUCKET} region=${S3_REGION} endpoint=${S3_ENDPOINT || '(aws default)'} ` +
        `direct=${S3_DIRECT_UPLOAD} cdn=${CDN_BASE} credentials=${hasStaticCredentials ? 'static' : 'iam-role/none'}`
);

if (!S3_ENDPOINT && !hasStaticCredentials) {
    console.warn(
        '[media/s3] S3_ENDPOINT 와 AWS 자격증명이 모두 없습니다. IAM Role 이 없는 환경이면 모든 업로드가 실패합니다. ' +
            '(S3_ENDPOINT / S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 확인)'
    );
}

export interface StorageHealth {
    ok: boolean;
    latency_ms: number;
    /** 실패 원인의 종류만 (AccessDenied, TimeoutError …). 호스트명·계정 정보는 로그에만 남긴다 */
    error?: string;
}

/**
 * 저장소 접근 가능 여부 확인 (HeadBucket, 기본 3초 타임아웃)
 *
 * 반환값은 /health 로 외부에 노출되므로 버킷·endpoint 같은 식별 정보를 담지 않는다.
 * 상세 원인은 서버 로그([media/s3])에서 확인한다.
 */
export async function checkStorageHealth(timeoutMs = 3000): Promise<StorageHealth> {
    const started = Date.now();
    try {
        await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }), {
            abortSignal: AbortSignal.timeout(timeoutMs)
        });
        return { ok: true, latency_ms: Date.now() - started };
    } catch (err) {
        const name = err instanceof Error ? err.name : 'Error';
        console.error(
            `[media/s3] storage health check failed (${name}) bucket=${S3_BUCKET} endpoint=${S3_ENDPOINT || '(aws default)'}:`,
            err instanceof Error ? err.message : err
        );
        return { ok: false, latency_ms: Date.now() - started, error: name };
    }
}
