/**
 * JPEG 직행 업로드 판정·준비.
 *
 * 변환 파이프라인을 기다리지 않고 웹이 최종 키에 바로 쓸 수 있는 JPEG 인지 가르고,
 * 쓸 바이트(메타데이터 구획 제거본)를 만든다. 파이프라인은 원본(raw/)에서 뒤이어 돌며
 * 같은 키를 같은 결과로 덮어쓰고 썸네일 등을 만든다.
 *
 * ⛔ 파이프라인이 해상도를 줄이는 이미지는 직행하지 않는다 — 웹은 재인코딩을 하지 않으므로
 *    결과가 달라진다. 축소 기준은 파이프라인과 **같은 값**이어야 한다.
 * ⛔ 첫 SOS 뒤에 다른 이미지·메타데이터 마커가 있으면 직행하지 않는다 — 여러 장이 든 JPEG
 *    (MPF·HDR 게인맵 등)는 뒤쪽 이미지에 메타데이터를 실을 수 있다.
 * ⛔ 판정을 못 하면 직행하지 않는다(null). 호출부는 현행 경로(변환 대기)로 보낸다.
 */
import {
    firstSosOffset,
    jpegOrientation,
    readJpegDimensions,
    stripJpegMetadataWithStatus
} from './jpeg-meta.js';

/** 이 폭을 넘으면 파이프라인이 축소한다(표시 방향 기준, 경계값은 축소 안 함) */
export const PIPELINE_MAX_WIDTH = 2560;
/** 총 픽셀이 이를 넘으면 파이프라인이 축소한다 */
export const PIPELINE_MAX_PIXELS = 30_000_000;

/** 첫 SOS 뒤에 나오면 직행하지 않는 마커 — APP1(Exif·XMP), APP13(IPTC), COM, SOI(다음 이미지) */
const MARKERS_FORBIDDEN_AFTER_SOS = new Set([0xe1, 0xed, 0xfe, 0xd8]);

/**
 * 파이프라인이 해상도를 건드리지 않는 JPEG 인가.
 * 원시 치수를 Orientation 5~8 이면 폭·높이를 바꿔 **표시 방향** 치수로 판단한다.
 */
export function fitsWithoutResize(data: Uint8Array): boolean {
    const dims = readJpegDimensions(data);
    if (!dims) return false;
    let w = dims.width;
    let h = dims.height;
    const o = jpegOrientation(data);
    if (o >= 5 && o <= 8) [w, h] = [h, w];
    if (w <= 0 || h <= 0) return false;
    return w <= PIPELINE_MAX_WIDTH && w * h <= PIPELINE_MAX_PIXELS;
}

/**
 * 첫 SOS 부터 끝까지 FF E1 / FF ED / FF FE / FF D8 이 있는가.
 * 압축 데이터 안의 FF 는 00 이나 RST 로만 이어지므로 이 조합은 마커다.
 * SOS 를 찾지 못하면 true(직행 불가)로 본다.
 */
export function hasMarkersAfterSOS(data: Uint8Array): boolean {
    const sos = firstSosOffset(data);
    if (sos < 0) return true;
    let i = data.indexOf(0xff, sos + 2);
    while (i >= 0 && i + 1 < data.length) {
        if (MARKERS_FORBIDDEN_AFTER_SOS.has(data[i + 1])) return true;
        i = data.indexOf(0xff, i + 1);
    }
    return false;
}

/**
 * 직행 가능하면 최종 키에 쓸 바이트를, 아니면 null 을 돌려준다.
 * 지울 메타데이터가 없으면 원본 바이트 그대로다(파이프라인과 같다).
 */
export function prepareDirectJpeg(data: Uint8Array): Uint8Array | null {
    if (!fitsWithoutResize(data)) return null;
    if (hasMarkersAfterSOS(data)) return null;
    const r = stripJpegMetadataWithStatus(data);
    if (r.status === 'invalid') return null;
    return r.data;
}
