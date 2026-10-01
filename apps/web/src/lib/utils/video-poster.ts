/**
 * 동영상 포스터(썸네일) 유틸
 *
 * 포스터는 두 가지가 있고 이름이 다르다.
 *  - 변환 파이프라인이 영상마다 만드는 것:  data/editor/2607/poster_abc1234.jpg
 *    → 저장된 주소가 없을 때 `deriveVideoPoster` 가 영상 주소에서 이 이름을 만들어 낸다.
 *  - 업로드 시점에 브라우저가 첫 프레임을 캡처한 것:  data/editor/2607/abc1234_poster.jpg
 *    → 업로드 응답의 poster_url 로 받아 본문 <video poster> 에 그대로 적는다(만들어 내지 않는다).
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
 * 동영상 URL → 변환 파이프라인이 만든 포스터 URL
 *   …/abc1234.mp4  →  …/poster_abc1234.jpg   (쿼리스트링·해시는 그대로 둔다)
 *
 * 파이프라인은 영상 파일 이름에서 확장자를 뗀 것 앞에 `poster_` 를 붙여 같은 폴더에 저장한다.
 * 브라우저 캡처 이름(…_poster.jpg)을 만들어 내면 안 된다 — 캡처는 실패할 수 있어 없는 주소가 된다.
 * 확장자가 없는 주소는 바꾸지 않는다.
 */
export function deriveVideoPoster(videoUrl: string): string {
    return videoUrl.replace(/([^/?#]+)\.[a-z0-9]+(?=(?:\?|#|$))/i, 'poster_$1.jpg');
}
