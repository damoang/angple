/**
 * 동영상 포스터(썸네일) 유틸
 *
 * 업로드 시점에 브라우저에서 첫 프레임을 캡처해 포스터 jpg 를 만든다.
 * 포스터는 동영상 키에서 기계적으로 도출되는 "관례 키"(형제 키)에 저장되므로
 * DB 스키마 변경 없이 URL 만으로 상호 변환할 수 있다:
 *   data/editor/2607/abc1234.mp4  →  data/editor/2607/abc1234_poster.jpg
 */

/** 포스터 캡처 시점(초) — 0초 프레임이 검은 인트로인 경우가 흔해 살짝 뒤로 */
const CAPTURE_TIME_SEC = 0.1;
/** 포스터 긴 변 최대 px — 표시·SEO 용도로 충분, 파일 수십 KB 유지 */
const MAX_DIMENSION = 1280;
/** 메타데이터 로드·seek 전체 타임아웃 — 초과 시 포스터 없이 진행 */
const CAPTURE_TIMEOUT_MS = 5000;

/**
 * 동영상 파일의 첫 프레임을 canvas 로 캡처해 jpg File 로 반환.
 *
 * 포스터는 best effort — 브라우저가 재생 못 하는 코덱(mov/avi/mkv 등)이나
 * 캡처 실패 시 null 을 반환하며, 이 경우에도 동영상 업로드 자체는 정상 진행된다.
 */
export async function captureVideoPoster(file: File): Promise<File | null> {
    if (typeof document === 'undefined' || !file.type.startsWith('video/')) return null;

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = objectUrl;

    try {
        const blob = await new Promise<Blob | null>((resolve) => {
            const timer = setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS);
            const fail = () => {
                clearTimeout(timer);
                resolve(null);
            };

            video.onerror = fail;
            video.onloadedmetadata = () => {
                if (!video.videoWidth || !video.videoHeight) return fail();
                // duration 이 캡처 시점보다 짧은 초단편은 0초 프레임 사용
                video.currentTime = Math.min(CAPTURE_TIME_SEC, video.duration || 0);
            };
            video.onseeked = () => {
                try {
                    const scale = Math.min(
                        1,
                        MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight)
                    );
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(video.videoWidth * scale);
                    canvas.height = Math.round(video.videoHeight * scale);
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return fail();
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    clearTimeout(timer);
                    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8);
                } catch {
                    fail();
                }
            };
        });

        if (!blob || blob.size === 0) return null;
        return new File([blob], 'poster.jpg', { type: 'image/jpeg' });
    } finally {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
    }
}

/**
 * 동영상 URL → 관례 포스터 URL (확장자를 _poster.jpg 로 치환)
 *
 * 포스터가 아직 없는 옛 동영상은 404 가 되지만, <video poster> 는 로드 실패를
 * 조용히 무시하므로(현행과 동일한 표시) 무해하다. backfill 이 채우면 자동 표시.
 */
export function deriveVideoPoster(videoUrl: string): string {
    return videoUrl.replace(/\.[a-z0-9]+(?=(?:\?|#|$))/i, '_poster.jpg');
}
