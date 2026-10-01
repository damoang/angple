/**
 * 업로드 키(raw/…) → 사용자에게 돌려줄 최종 키(data/…).
 *
 * 변환 파이프라인은 일부 영상 형식을 mp4 로 바꿔 **확장자가 달라진 이름**으로 저장한다.
 * 올린 확장자 그대로 최종 키를 만들면 존재하지 않는 주소가 글에 저장된다.
 */

/** 변환 파이프라인이 mp4 로 바꿔 저장하는 확장자 — 파이프라인의 목록과 같아야 한다 */
const CONVERTED_TO_MP4 = new Set(['.mov', '.avi', '.mkv', '.3gp', '.flv']);

export interface FinalKeyOptions {
    /**
     * 변환 파이프라인을 거치는가.
     * 직접 업로드 모드는 올린 파일이 그대로 최종 키에 저장되므로 false 를 넘긴다.
     */
    converted: boolean;
}

/** 최종 키가 생기기를 기다리는 기본 한도 — 복사·이미지 변환은 수 초 안에 끝난다 */
export const DEFAULT_PROCESS_WAIT_MS = 8_000;

/**
 * mp4 로 재인코딩되는 영상의 대기 한도.
 * 재인코딩은 수십 초가 걸린다. 기본 한도로는 대부분 아직 없는 주소를 돌려주게 되고,
 * 그 주소를 바로 요청한 응답(없음)이 CDN 에 남아 한동안 영상이 깨져 보인다.
 * 앞단 프록시의 응답 대기 제한(60초)보다 충분히 짧게 둔다 — 넘기면 업로드 자체가 실패한다.
 */
export const CONVERTED_VIDEO_WAIT_MS = 40_000;

/** 키의 마지막 확장자가 mp4 로 변환되는 형식이면 그 확장자(원형)를 돌려준다 */
function convertedExt(key: string): string | null {
    const ext = key.match(/\.[a-z0-9]+$/i)?.[0];
    return ext && CONVERTED_TO_MP4.has(ext.toLowerCase()) ? ext : null;
}

export function rawKeyToFinalKey(rawKey: string, options: FinalKeyOptions): string {
    const key = rawKey.replace(/^raw\//, 'data/');
    if (!options.converted) return key;

    const ext = convertedExt(key);
    return ext ? `${key.slice(0, -ext.length)}.mp4` : key;
}

/** 이 업로드의 최종 키가 생기기를 얼마나 기다릴지(ms) */
export function processWaitMs(rawKey: string, options: FinalKeyOptions): number {
    return options.converted && convertedExt(rawKey)
        ? CONVERTED_VIDEO_WAIT_MS
        : DEFAULT_PROCESS_WAIT_MS;
}
