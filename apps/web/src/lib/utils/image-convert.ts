/** HEIC/HEIF → JPEG 변환 (iPhone 사진 지원) */

const HEIC_EXTENSIONS = /\.(heic|heif)$/i;

// iOS 사파리 등에서 heic2any(WASM) 변환이 큰 사진에서 멈추는 경우를 대비한 상한.
// 초과하면 무한 대기(#12981: "이미지 변환이 지연" 상태로 업로드가 영영 안 끝남) 대신
// 명확한 안내로 실패시켜 사용자가 다른 방법으로 재시도할 수 있게 한다.
const HEIC_CONVERT_TIMEOUT_MS = 45000;

function isHeicFile(file: File): boolean {
    return (
        file.type === 'image/heic' || file.type === 'image/heif' || HEIC_EXTENSIONS.test(file.name)
    );
}

/** promise 가 ms 안에 끝나지 않으면 timeoutError 로 거부한다(원본 promise 는 방치). */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError: Error): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(timeoutError), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

/**
 * HEIC/HEIF 파일이면 JPEG로 변환, 아니면 그대로 반환.
 * heic2any는 lazy import로 HEIC 업로드 시에만 로드 (~170KB).
 * 변환이 지나치게 오래 걸리거나 실패하면 무한 대기 대신 명확한 안내로 실패시킨다(#12981).
 */
export async function convertHeicIfNeeded(file: File): Promise<File> {
    if (!isHeicFile(file)) return file;

    try {
        const heic2any = (await import('heic2any')).default;
        const blob = await withTimeout(
            heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }) as Promise<Blob | Blob[]>,
            HEIC_CONVERT_TIMEOUT_MS,
            new Error('HEIC_CONVERT_TIMEOUT')
        );
        const resultBlob = Array.isArray(blob) ? blob[0] : blob;
        const newName = file.name.replace(HEIC_EXTENSIONS, '.jpg');
        return new File([resultBlob], newName, { type: 'image/jpeg' });
    } catch (err) {
        const isTimeout = err instanceof Error && err.message === 'HEIC_CONVERT_TIMEOUT';
        throw new Error(
            isTimeout
                ? '이미지 변환이 오래 걸려 중단했습니다. 사진 크기를 줄이거나 JPG·PNG(스크린샷 등)로 다시 시도해 주세요.'
                : 'HEIC 이미지 변환에 실패했습니다. 사진을 JPG·PNG로 변환해 다시 시도해 주세요.'
        );
    }
}

/** 이미지 파일 여부 판정 (HEIC 포함) */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/') || HEIC_EXTENSIONS.test(file.name);
}
