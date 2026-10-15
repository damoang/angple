/**
 * JPEG 메타데이터 구획 제거 — 재인코딩 없이 바이트 단위로 처리한다(픽셀 불변).
 *
 * 업로드 변환 파이프라인(Lambda)의 JPEG 메타데이터 제거 규칙을 **그대로** 옮긴 것이다.
 * 웹이 최종 키에 먼저 쓰고, 파이프라인이 뒤이어 같은 키를 같은 결과로 덮어쓴다.
 * ⛔ 규칙을 여기서만 바꾸지 마라 — 두 결과가 달라지면 같은 주소에 서로 다른 파일이 남는다.
 *
 * 지우는 것: APP1(Exif·XMP, 여러 개면 전부), APP13(IPTC/Photoshop), COM
 * 남기는 것: 그 밖의 구획(APP0 JFIF, APP2 ICC, APP14 Adobe 등)과 SOS 이후 전부
 *
 * 방향(Orientation)은 남긴다. 픽셀을 돌리지 않으므로, 지우면 세로 사진이 누워 보인다.
 * 원본 값이 1 이 아니면 그 태그 하나만 든 최소 Exif 를 APP0 뒤에 다시 넣는다.
 *
 * 구조를 해석할 수 없으면 원본을 그대로 돌려준다 — 파일을 망가뜨리지 않는 것이 우선이다.
 */

export type StripStatus = 'stripped' | 'unchanged' | 'invalid';

export interface StripResult {
    data: Uint8Array;
    /**
     * stripped = 구획을 지웠다 / unchanged = 구조는 정상, 지울 것이 없다 /
     * invalid = 구조를 해석할 수 없어 원본을 그대로 돌려줬다
     */
    status: StripStatus;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

function readU16BE(data: Uint8Array, at: number): number {
    return (data[at] << 8) | data[at + 1];
}

function concat(parts: Uint8Array[]): Uint8Array {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return out;
}

/** 상태까지 돌려주는 본체. 호출부가 「지울 것 없음」과 「해석 불가」를 구분할 때 쓴다. */
export function stripJpegMetadataWithStatus(data: Uint8Array): StripResult {
    const invalid: StripResult = { data, status: 'invalid' };
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return invalid;

    let orientation = 1;
    let removed = false;
    const kept: Array<[number, number]> = [];
    let sosAt = -1;

    let i = 2;
    while (i < data.length) {
        if (data[i] !== 0xff) return invalid;
        // 채움 바이트(FF FF …)는 건너뛴다
        while (i + 1 < data.length && data[i + 1] === 0xff) i++;
        if (i + 1 >= data.length) return invalid;

        const marker = data[i + 1];
        if (marker === 0xda) {
            // SOS — 여기부터는 압축 데이터다. 손대지 않는다
            sosAt = i;
            break;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            kept.push([i, i + 2]);
            i += 2;
            continue;
        }
        if (i + 4 > data.length) return invalid;
        const segLen = readU16BE(data, i + 2);
        const end = i + 2 + segLen;
        if (segLen < 2 || end > data.length) return invalid;

        if (marker === 0xe1) {
            // APP1 — Exif 또는 XMP
            const o = exifOrientation(data.subarray(i + 4, end));
            if (o !== null) orientation = o;
            removed = true;
        } else if (marker === 0xed || marker === 0xfe) {
            // APP13, COM
            removed = true;
        } else {
            kept.push([i, end]);
        }
        i = end;
    }
    if (sosAt < 0) return invalid;
    if (!removed) return { data, status: 'unchanged' };

    // 방향 태그는 JFIF(APP0) 뒤, 나머지 구획 앞에 둔다
    const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
    let inserted = orientation === 1;
    for (const [start, end] of kept) {
        const isAPP0 = end - start >= 2 && data[start + 1] === 0xe0;
        if (!inserted && !isAPP0) {
            parts.push(orientationSegment(orientation));
            inserted = true;
        }
        parts.push(data.subarray(start, end));
    }
    if (!inserted) parts.push(orientationSegment(orientation));
    parts.push(data.subarray(sosAt));
    return { data: concat(parts), status: 'stripped' };
}

/** 메타데이터 구획을 걷어낸다. 바뀌었으면 changed=true. 해석 불가·지울 것 없음이면 원본과 false. */
export function stripJpegMetadata(data: Uint8Array): { data: Uint8Array; changed: boolean } {
    const r = stripJpegMetadataWithStatus(data);
    return { data: r.data, changed: r.status === 'stripped' };
}

/** 첫 SOS 마커의 위치. 구조를 해석할 수 없거나 SOS 가 없으면 -1 (제거와 같은 순회 규칙) */
export function firstSosOffset(data: Uint8Array): number {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return -1;
    let i = 2;
    while (i < data.length) {
        if (data[i] !== 0xff) return -1;
        while (i + 1 < data.length && data[i + 1] === 0xff) i++;
        if (i + 1 >= data.length) return -1;
        const marker = data[i + 1];
        if (marker === 0xda) return i;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            i += 2;
            continue;
        }
        if (i + 4 > data.length) return -1;
        const segLen = readU16BE(data, i + 2);
        const end = i + 2 + segLen;
        if (segLen < 2 || end > data.length) return -1;
        i = end;
    }
    return -1;
}

/**
 * JPEG 의 Exif Orientation 값. 태그가 없거나 구조를 읽을 수 없으면 1(정방향).
 * Exif 가 여럿이면 **마지막** 유효 값 — 제거 시 보존하는 값과 같은 규칙이다.
 */
export function jpegOrientation(data: Uint8Array): number {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return 1;
    let found = 1;
    let i = 2;
    while (i + 4 <= data.length) {
        if (data[i] !== 0xff) return 1;
        while (i + 1 < data.length && data[i + 1] === 0xff) i++;
        if (i + 1 >= data.length) return 1;
        const marker = data[i + 1];
        if (marker === 0xda) return found; // 메타데이터 구획은 SOS 앞에만 있다
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            i += 2;
            continue;
        }
        if (i + 4 > data.length) return 1;
        const end = i + 2 + readU16BE(data, i + 2);
        if (end > data.length || end < i + 4) return 1;
        if (marker === 0xe1) {
            const o = exifOrientation(data.subarray(i + 4, end));
            if (o !== null) found = o;
        }
        i = end;
    }
    return found;
}

/**
 * APP1 본문(길이 필드 뒤)에서 Orientation(0x0112) 값을 읽는다.
 * Exif 가 아니거나(XMP 등) 구조가 어긋나거나 값이 1~8 밖이면 null.
 */
export function exifOrientation(payload: Uint8Array): number | null {
    if (payload.length < 14) return null;
    for (let k = 0; k < EXIF_HEADER.length; k++) {
        if (payload[k] !== EXIF_HEADER[k]) return null;
    }
    const tiff = payload.subarray(6);
    let little: boolean;
    if (tiff[0] === 0x49 && tiff[1] === 0x49) little = true;
    else if (tiff[0] === 0x4d && tiff[1] === 0x4d) little = false;
    else return null;

    const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
    if (view.getUint16(2, little) !== 42) return null;
    const ifd = view.getUint32(4, little);
    if (ifd < 8 || ifd + 2 > tiff.length) return null;
    const count = view.getUint16(ifd, little);
    for (let n = 0; n < count; n++) {
        const e = ifd + 2 + n * 12;
        if (e + 12 > tiff.length) return null;
        if (view.getUint16(e, little) === 0x0112) {
            const v = view.getUint16(e + 8, little);
            return v >= 1 && v <= 8 ? v : null;
        }
    }
    return null;
}

/** Orientation 태그 하나만 든 APP1(Exif, 빅엔디언) 구획 */
export function orientationSegment(orientation: number): Uint8Array {
    const tiff = [
        0x4d,
        0x4d,
        0x00,
        0x2a, // 빅엔디언 TIFF
        0x00,
        0x00,
        0x00,
        0x08, // IFD0 위치
        0x00,
        0x01, // 항목 1개
        0x01,
        0x12, // Orientation
        0x00,
        0x03, // SHORT
        0x00,
        0x00,
        0x00,
        0x01, // 개수 1
        (orientation >> 8) & 0xff,
        orientation & 0xff,
        0x00,
        0x00, // 값
        0x00,
        0x00,
        0x00,
        0x00 // 다음 IFD 없음
    ];
    const payloadLen = EXIF_HEADER.length + tiff.length;
    const segLen = payloadLen + 2;
    return new Uint8Array([
        0xff,
        0xe1,
        (segLen >> 8) & 0xff,
        segLen & 0xff,
        ...EXIF_HEADER,
        ...tiff
    ]);
}

/**
 * SOF 구획에서 원시 픽셀 치수를 읽는다(헤더만, 디코딩 없음).
 * 기본·확장·점진(SOF0/1/2), 8비트, 성분 1·3·4 만 인정한다. 그 밖이거나 구조가 어긋나면 null.
 * ⛔ 판정을 못 하면 null — 호출부는 현행 경로로 보낸다(모를 때 직행하지 않는다).
 */
export function readJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let i = 2;
    while (i < data.length) {
        if (data[i] !== 0xff) return null;
        while (i + 1 < data.length && data[i + 1] === 0xff) i++;
        if (i + 1 >= data.length) return null;
        const marker = data[i + 1];
        if (marker === 0xda || marker === 0xd9) return null; // SOF 보다 SOS/EOI 가 먼저 — 판정 불가
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            i += 2;
            continue;
        }
        if (i + 4 > data.length) return null;
        const segLen = readU16BE(data, i + 2);
        const end = i + 2 + segLen;
        if (segLen < 2 || end > data.length) return null;

        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            if (segLen < 8) return null;
            const precision = data[i + 4];
            const height = readU16BE(data, i + 5);
            const width = readU16BE(data, i + 7);
            const components = data[i + 9];
            if (precision !== 8) return null;
            if (components !== 1 && components !== 3 && components !== 4) return null;
            if (segLen !== 8 + 3 * components) return null;
            if (width <= 0 || height <= 0) return null;
            return { width, height };
        }
        // 그 밖의 SOF(무손실·산술 부호화 등)는 판정하지 않는다
        if (
            marker === 0xc3 ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf)
        ) {
            return null;
        }
        i = end;
    }
    return null;
}
