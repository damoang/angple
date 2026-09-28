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

// S3 호환 저장소(R2 등)는 IAM Role 이 없으므로 정적 자격증명이 반드시 필요하다.
// AWS 기본 endpoint 는 EC2 IAM Role 로 동작할 수 있어 여기서 경고하지 않는다.
if (S3_ENDPOINT && !hasStaticCredentials) {
    console.warn(
        `[media/s3] S3_ENDPOINT(${S3_ENDPOINT}) 가 지정됐지만 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 가 없습니다. 모든 업로드가 실패합니다.`
    );
}

export interface StorageHealth {
    ok: boolean;
    bucket: string;
    endpoint: string;
    latency_ms: number;
    error?: string;
}

/** 저장소 접근 가능 여부 확인 (HeadBucket, 기본 3초 타임아웃) */
export async function checkStorageHealth(timeoutMs = 3000): Promise<StorageHealth> {
    const started = Date.now();
    const base = { bucket: S3_BUCKET, endpoint: S3_ENDPOINT || 'aws' };
    try {
        await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }), {
            abortSignal: AbortSignal.timeout(timeoutMs)
        });
        return { ok: true, ...base, latency_ms: Date.now() - started };
    } catch (err) {
        const name = err instanceof Error ? err.name : 'Error';
        const message = err instanceof Error ? err.message : String(err);
        return {
            ok: false,
            ...base,
            latency_ms: Date.now() - started,
            error: `${name}: ${message}`
        };
    }
}
