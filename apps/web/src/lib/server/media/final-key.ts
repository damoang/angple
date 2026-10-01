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

export function rawKeyToFinalKey(rawKey: string, options: FinalKeyOptions): string {
    const key = rawKey.replace(/^raw\//, 'data/');
    if (!options.converted) return key;

    const ext = key.match(/\.[a-z0-9]+$/i)?.[0];
    if (ext && CONVERTED_TO_MP4.has(ext.toLowerCase())) {
        return `${key.slice(0, -ext.length)}.mp4`;
    }
    return key;
}
