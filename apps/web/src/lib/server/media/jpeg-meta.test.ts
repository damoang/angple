import { describe, expect, it } from 'vitest';
import {
    exifOrientation,
    jpegOrientation,
    orientationSegment,
    readJpegDimensions,
    stripJpegMetadata,
    stripJpegMetadataWithStatus
} from './jpeg-meta';

// ── 표본 JPEG 조립 도구 ──────────────────────────────────────────────

const latin1 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'latin1'));

function build(...parts: Uint8Array[]): Uint8Array {
    return new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p))));
}

/** 길이 필드를 채운 JPEG 구획 */
function seg(marker: number, payload: Uint8Array): Uint8Array {
    const len = payload.length + 2;
    return build(new Uint8Array([0xff, marker, (len >> 8) & 0xff, len & 0xff]), payload);
}

/** Orientation 과 GPS 포인터가 든 Exif 본문 */
function exifPayload(little: boolean, orientation: number): Uint8Array {
    const tiff = new Uint8Array(8 + 2 + 12 * 2 + 4);
    const v = new DataView(tiff.buffer);
    tiff.set(little ? [0x49, 0x49] : [0x4d, 0x4d], 0);
    v.setUint16(2, 42, little);
    v.setUint32(4, 8, little);
    v.setUint16(8, 2, little);
    // Orientation
    v.setUint16(10, 0x0112, little);
    v.setUint16(12, 3, little);
    v.setUint32(14, 1, little);
    v.setUint16(18, orientation, little);
    // GPSInfo 포인터 — 위치 정보가 있다는 표시
    v.setUint16(22, 0x8825, little);
    v.setUint16(24, 4, little);
    v.setUint32(26, 1, little);
    v.setUint32(30, 0x1234, little);
    return build(latin1('Exif\x00\x00'), tiff);
}

/**
 * 실제 위치 값까지 든 Exif 본문 — IFD0(Orientation·Make·GPS 포인터) + GPS IFD(위도·경도).
 * 위도 37.5665 / 경도 126.9780 을 유리수로 넣는다.
 */
function exifWithGps(little: boolean, orientation: number): Uint8Array {
    const tiff = new Uint8Array(200);
    const v = new DataView(tiff.buffer);
    tiff.set(little ? [0x49, 0x49] : [0x4d, 0x4d], 0);
    v.setUint16(2, 42, little);
    v.setUint32(4, 8, little);
    // IFD0: 3 항목
    v.setUint16(8, 3, little);
    let e = 10;
    const entry = (tag: number, type: number, count: number, value: number, short = false) => {
        v.setUint16(e, tag, little);
        v.setUint16(e + 2, type, little);
        v.setUint32(e + 4, count, little);
        if (short) v.setUint16(e + 8, value, little);
        else v.setUint32(e + 8, value, little);
        e += 12;
    };
    entry(0x0112, 3, 1, orientation, true); // Orientation
    entry(0x010f, 2, 4, 0x41424300); // Make "ABC"
    entry(0x8825, 4, 1, 60); // GPS IFD 위치
    v.setUint32(e, 0, little); // 다음 IFD 없음
    // GPS IFD @60: 4 항목
    e = 60;
    v.setUint16(e, 4, little);
    e += 2;
    entry(0x0001, 2, 2, little ? 0x0000004e : 0x4e000000); // GPSLatitudeRef "N"
    entry(0x0002, 5, 3, 120); // GPSLatitude
    entry(0x0003, 2, 2, little ? 0x00000045 : 0x45000000); // GPSLongitudeRef "E"
    entry(0x0004, 5, 3, 144); // GPSLongitude
    v.setUint32(e, 0, little);
    const rational = (at: number, vals: Array<[number, number]>) =>
        vals.forEach(([n, d], k) => {
            v.setUint32(at + k * 8, n, little);
            v.setUint32(at + k * 8 + 4, d, little);
        });
    rational(120, [
        [37, 1],
        [33, 1],
        [5994, 100]
    ]);
    rational(144, [
        [126, 1],
        [58, 1],
        [4080, 100]
    ]);
    return build(latin1('Exif\x00\x00'), tiff);
}

/** 기본(SOF0) 프레임 헤더 — 3 성분, 8비트 */
function sof0(width: number, height: number): Uint8Array {
    return seg(
        0xc0,
        new Uint8Array([
            8,
            (height >> 8) & 0xff,
            height & 0xff,
            (width >> 8) & 0xff,
            width & 0xff,
            3,
            1,
            0x22,
            0,
            2,
            0x11,
            1,
            3,
            0x11,
            1
        ])
    );
}

const soi = new Uint8Array([0xff, 0xd8]);
const app0 = seg(0xe0, latin1('JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'));
const icc = seg(0xe2, latin1('ICC_PROFILE\x00\x01\x01fake-profile'));
const dqt = seg(0xdb, new Uint8Array(65).fill(0x10));
// SOS 뒤 압축 데이터에는 FF 00 과 RST 마커(FF D0)가 섞인다. 한 바이트도 바뀌면 안 된다.
const scan = build(
    seg(0xda, new Uint8Array([1, 1, 0, 0, 0x3f, 0])),
    new Uint8Array([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd3, 0x00, 0xff, 0xd9])
);

const has = (hay: Uint8Array, needle: Uint8Array | string): boolean =>
    Buffer.from(hay).includes(
        typeof needle === 'string' ? Buffer.from(needle, 'latin1') : Buffer.from(needle)
    );

/** SOS 이전 구획들의 마커 목록 */
function markersBeforeSOS(data: Uint8Array): number[] {
    const out: number[] = [];
    let i = 2;
    while (i + 4 <= data.length) {
        const m = data[i + 1];
        if (m === 0xda) break;
        out.push(m);
        i += 2 + ((data[i + 2] << 8) | data[i + 3]);
    }
    return out;
}

/** SOS 부터 끝까지(압축 데이터) */
function fromSOS(data: Uint8Array): Uint8Array {
    let i = 2;
    while (i + 4 <= data.length && data[i + 1] !== 0xda) {
        i += 2 + ((data[i + 2] << 8) | data[i + 3]);
    }
    return data.subarray(i);
}

// ── 변환 파이프라인 시험의 이식 ──────────────────────────────────────

describe('stripJpegMetadata (파이프라인 규칙과 동일)', () => {
    it('Exif 만 빠지고 나머지 바이트는 그대로다 (방향 1)', () => {
        const input = build(soi, app0, seg(0xe1, exifPayload(false, 1)), icc, dqt, scan);
        const { data, changed } = stripJpegMetadata(input);
        expect(changed).toBe(true);
        expect(has(data, 'Exif')).toBe(false);
        expect(Buffer.from(data).equals(Buffer.from(build(soi, app0, icc, dqt, scan)))).toBe(true);
    });

    it('방향이 1 이 아니면 방향 태그만 든 최소 Exif 가 JFIF 바로 뒤에 들어간다', () => {
        for (const little of [false, true]) {
            const input = build(soi, app0, seg(0xe1, exifPayload(little, 6)), icc, dqt, scan);
            const { data, changed } = stripJpegMetadata(input);
            expect(changed).toBe(true);
            const want = build(soi, app0, orientationSegment(6), icc, dqt, scan);
            expect(Buffer.from(data).equals(Buffer.from(want))).toBe(true);
            expect(exifOrientation(orientationSegment(6).subarray(4))).toBe(6);
            // ⛔ 위치 정보 포인터(0x8825)가 남으면 안 된다
            expect(has(data, new Uint8Array([0x88, 0x25]))).toBe(false);
            expect(has(data, new Uint8Array([0x25, 0x88]))).toBe(false);
        }
    });

    it('XMP·IPTC·COM 이 빠진다', () => {
        const xmp = seg(0xe1, latin1('http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta>gps</x:xmpmeta>'));
        const iptc = seg(0xed, latin1('Photoshop 3.0\x008BIM'));
        const com = seg(0xfe, latin1('created by camera'));
        const { data, changed } = stripJpegMetadata(build(soi, app0, xmp, iptc, com, dqt, scan));
        expect(changed).toBe(true);
        expect(Buffer.from(data).equals(Buffer.from(build(soi, app0, dqt, scan)))).toBe(true);
    });

    it('APP0 없이 Exif 로 시작하면 방향 구획이 맨 앞에 온다', () => {
        const input = build(soi, seg(0xe1, exifPayload(true, 8)), dqt, scan);
        const { data } = stripJpegMetadata(input);
        const want = build(soi, orientationSegment(8), dqt, scan);
        expect(Buffer.from(data).equals(Buffer.from(want))).toBe(true);
    });

    it('지울 것이 없으면 원본 그대로, changed=false', () => {
        const input = build(soi, app0, icc, dqt, scan);
        const r = stripJpegMetadataWithStatus(input);
        expect(r.status).toBe('unchanged');
        expect(r.data).toBe(input);
        expect(stripJpegMetadata(input).changed).toBe(false);
    });

    it('해석할 수 없으면 원본을 그대로 돌려준다 (파일을 망가뜨리지 않는다)', () => {
        const full = build(soi, app0, seg(0xe1, exifPayload(false, 6)), dqt, scan);
        const cases: Record<string, Uint8Array> = {
            '빈 입력': new Uint8Array(0),
            'JPEG 아님(PNG)': latin1('\x89PNG\r\n\x1a\n....'),
            'SOI 만': soi,
            '구획 중간에서 잘림': full.subarray(0, soi.length + app0.length + 10),
            'SOS 없음': build(soi, app0, seg(0xe1, exifPayload(false, 6)), dqt),
            '길이 필드가 거짓': build(soi, new Uint8Array([0xff, 0xe1, 0xff, 0xff, 1, 2, 3])),
            '길이 0': build(soi, new Uint8Array([0xff, 0xe1, 0x00, 0x00]), scan),
            '마커 자리에 쓰레기': build(soi, new Uint8Array([0x00, 0x11, 0x22, 0x33]), scan)
        };
        for (const [name, input] of Object.entries(cases)) {
            const r = stripJpegMetadataWithStatus(input);
            expect(r.status, name).toBe('invalid');
            expect(r.data, name).toBe(input);
            expect(stripJpegMetadata(input).changed, name).toBe(false);
        }
    });

    it('Exif 가 아니거나 구조·값이 어긋나면 방향을 읽지 않는다', () => {
        const bad: Record<string, Uint8Array> = {
            XMP: latin1('http://ns.adobe.com/xap/1.0/\x00<x/>'),
            짧다: latin1('Exif\x00\x00MM'),
            '바이트 순서 이상': latin1('Exif\x00\x00XX\x00\x2A\x00\x00\x00\x08\x00\x00'),
            '범위 밖 값': exifPayload(false, 9)
        };
        for (const [name, p] of Object.entries(bad)) {
            expect(exifOrientation(p), name).toBeNull();
        }
        for (let o = 1; o <= 8; o++) {
            expect(exifOrientation(exifPayload(true, o))).toBe(o);
        }
    });
});

// ── 추가 표본: 실제 위치값·여러 APP1·XMP 확장·APP13·COM ───────────────

describe('stripJpegMetadata — 개인정보 표본', () => {
    const xmp = seg(
        0xe1,
        latin1(
            'http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta><exif:GPSLatitude>37,33.999N</exif:GPSLatitude></x:xmpmeta>'
        )
    );
    const xmpExt = seg(
        0xe1,
        latin1(
            'http://ns.adobe.com/xmp/extension/\x00' +
                '0123456789ABCDEF0123456789ABCDEF' +
                '\x00\x00\x01\x00\x00\x00\x00\x00<rdf:Description exif:GPSLongitude="126,58.68E"/>'
        )
    );
    const iptc = seg(
        0xed,
        latin1('Photoshop 3.0\x008BIM\x04\x04\x00\x00\x00\x00\x00\x10City:Seoul')
    );
    const com = seg(0xfe, latin1('owner=hong gildong'));

    for (const [label, orientation] of [
        ['세로(6)', 6],
        ['세로(8)', 8],
        ['가로(1)', 1]
    ] as const) {
        for (const little of [true, false]) {
            it(`${label}·${little ? 'II' : 'MM'}: 위치·XMP·IPTC·COM 이 모두 빠지고 방향만 남는다`, () => {
                const input = build(
                    soi,
                    app0,
                    seg(0xe1, exifWithGps(little, orientation)),
                    xmp,
                    xmpExt,
                    icc,
                    iptc,
                    com,
                    dqt,
                    sof0(1600, 1200),
                    scan
                );
                const { data, changed } = stripJpegMetadata(input);
                expect(changed).toBe(true);

                // 압축 데이터(SOS 이후)는 바이트 단위로 동일
                expect(Buffer.from(fromSOS(data)).equals(Buffer.from(fromSOS(input)))).toBe(true);

                // 남은 구획: APP0, (방향 Exif), APP2(ICC), DQT, SOF0 — APP13·COM 없음
                const markers = markersBeforeSOS(data);
                expect(markers).not.toContain(0xed);
                expect(markers).not.toContain(0xfe);
                expect(markers.filter((m) => m === 0xe1).length).toBe(orientation === 1 ? 0 : 1);
                expect(markers).toContain(0xe2);

                for (const needle of [
                    'GPSLatitude',
                    'GPSLongitude',
                    'xmpmeta',
                    'xmp/extension',
                    '8BIM',
                    'Seoul',
                    'hong',
                    'ABC'
                ]) {
                    expect(has(data, needle), needle).toBe(false);
                }
                expect(has(data, new Uint8Array([0x88, 0x25]))).toBe(false);
                expect(has(data, new Uint8Array([0x25, 0x88]))).toBe(false);

                // 방향은 보존
                expect(jpegOrientation(data)).toBe(orientation);
                if (orientation !== 1) {
                    expect(has(data, orientationSegment(orientation))).toBe(true);
                }
            });
        }
    }

    it('APP1 이 여러 개면 전부 지우고, 방향은 마지막 유효 Exif 값을 따른다', () => {
        const input = build(
            soi,
            app0,
            seg(0xe1, exifWithGps(true, 3)),
            xmp,
            seg(0xe1, exifPayload(false, 6)),
            dqt,
            scan
        );
        expect(jpegOrientation(input)).toBe(6);
        const { data } = stripJpegMetadata(input);
        expect(markersBeforeSOS(data).filter((m) => m === 0xe1).length).toBe(1);
        expect(jpegOrientation(data)).toBe(6);
        expect(has(data, 'xmpmeta')).toBe(false);
    });

    it('채움 바이트(FF FF)가 끼어 있어도 지운다', () => {
        const input = build(
            soi,
            new Uint8Array([0xff]),
            seg(0xe1, exifWithGps(true, 1)),
            dqt,
            scan
        );
        const { data, changed } = stripJpegMetadata(input);
        expect(changed).toBe(true);
        expect(Buffer.from(data).equals(Buffer.from(build(soi, dqt, scan)))).toBe(true);
    });
});

describe('jpegOrientation', () => {
    it('Exif 가 없으면 1', () => {
        expect(jpegOrientation(build(soi, app0, dqt, scan))).toBe(1);
    });
    it('JPEG 가 아니면 1', () => {
        expect(jpegOrientation(latin1('\x89PNG\r\n\x1a\n'))).toBe(1);
    });
    it('Exif 방향을 읽는다', () => {
        expect(jpegOrientation(build(soi, app0, seg(0xe1, exifPayload(true, 8)), scan))).toBe(8);
    });
});

describe('readJpegDimensions', () => {
    it('SOF0 의 폭·높이를 읽는다', () => {
        expect(readJpegDimensions(build(soi, app0, dqt, sof0(4032, 3024), scan))).toEqual({
            width: 4032,
            height: 3024
        });
    });
    it('SOF 보다 SOS 가 먼저면 판정 불가', () => {
        expect(readJpegDimensions(build(soi, app0, dqt, scan))).toBeNull();
    });
    it('무손실 등 다른 SOF 는 판정하지 않는다', () => {
        const sof3 = sof0(100, 100);
        sof3[1] = 0xc3;
        expect(readJpegDimensions(build(soi, sof3, scan))).toBeNull();
    });
    it('성분 수와 길이가 맞지 않으면 판정 불가', () => {
        const broken = sof0(100, 100);
        broken[9] = 2; // 성분 수 2 — 허용 밖
        expect(readJpegDimensions(build(soi, broken, scan))).toBeNull();
    });
    it('JPEG 가 아니면 null', () => {
        expect(readJpegDimensions(latin1('\x89PNG\r\n\x1a\n....'))).toBeNull();
    });
});
