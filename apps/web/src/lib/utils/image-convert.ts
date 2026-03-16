/** HEIC/HEIF → JPEG 변환 (iPhone 사진 지원) */

const HEIC_EXTENSIONS = /\.(heic|heif)$/i;

function isHeicFile(file: File): boolean {
    return (
        file.type === 'image/heic' || file.type === 'image/heif' || HEIC_EXTENSIONS.test(file.name)
    );
}

/**
 * HEIC/HEIF 파일이면 JPEG로 변환, 아니면 그대로 반환.
 * heic2any는 lazy import로 HEIC 업로드 시에만 로드 (~170KB).
 */
export async function convertHeicIfNeeded(file: File): Promise<File> {
    if (!isHeicFile(file)) return file;

    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(HEIC_EXTENSIONS, '.jpg');
    return new File([resultBlob], newName, { type: 'image/jpeg' });
}

/** 이미지 파일 여부 판정 (HEIC 포함) */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/') || HEIC_EXTENSIONS.test(file.name);
}
