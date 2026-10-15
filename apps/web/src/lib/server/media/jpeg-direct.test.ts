import { describe, expect, it } from 'vitest';
import {
    PIPELINE_MAX_PIXELS,
    PIPELINE_MAX_WIDTH,
    fitsWithoutResize,
    prepareDirectJpeg
} from './jpeg-direct';
import { orientationSegment } from './jpeg-meta';

const latin1 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'latin1'));
const build = (...parts: Uint8Array[]): Uint8Array =>
    new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p))));

function seg(marker: number, payload: Uint8Array): Uint8Array {
    const len = payload.length + 2;
    return build(new Uint8Array([0xff, marker, (len >> 8) & 0xff, len & 0xff]), payload);
}

function sof0(width: number, height: number): Uint8Array {
    return seg(
        0xc0,
        new Uint8Array([
            8,
            (height >> 8) & 0xff,
            height & 0xff,
            (width >> 8) & 0xff,
            width & 0xff,
            1,
            1,
            0x11,
            0
        ])
    );
}

const soi = new Uint8Array([0xff, 0xd8]);
const app0 = seg(0xe0, latin1('JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'));
const scan = build(
    seg(0xda, new Uint8Array([1, 1, 0, 0, 0x3f, 0])),
    new Uint8Array([0x12, 0xff, 0x00, 0x34, 0xff, 0xd9])
);
const gpsXmp = seg(
    0xe1,
    latin1('http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta>GPSLatitude</x:xmpmeta>')
);

/** 방향 태그만 든 Exif(원본 쪽 표본) */
const exifOrientation = (o: number) => orientationSegment(o);

function jpeg(width: number, height: number, ...extra: Uint8Array[]): Uint8Array {
    return build(soi, app0, ...extra, sof0(width, height), scan);
}

describe('fitsWithoutResize', () => {
    it('폭 상한 이하·픽셀 상한 이하면 직행 가능', () => {
        expect(fitsWithoutResize(jpeg(1600, 1200))).toBe(true);
        expect(fitsWithoutResize(jpeg(PIPELINE_MAX_WIDTH, 1000))).toBe(true); // 경계값은 축소 안 함
    });

    it('폭이 상한을 넘으면 직행하지 않는다', () => {
        expect(fitsWithoutResize(jpeg(PIPELINE_MAX_WIDTH + 1, 100))).toBe(false);
        expect(fitsWithoutResize(jpeg(4032, 3024))).toBe(false);
    });

    it('폭이 상한 이하라도 총 픽셀이 상한을 넘으면 직행하지 않는다', () => {
        const h = Math.floor(PIPELINE_MAX_PIXELS / 2000) + 1;
        expect(fitsWithoutResize(jpeg(2000, h))).toBe(false);
        expect(fitsWithoutResize(jpeg(2000, Math.floor(PIPELINE_MAX_PIXELS / 2000)))).toBe(true);
    });

    it('방향 5~8 이면 표시 방향(폭·높이 교환)으로 판단한다', () => {
        // 원시 3000×2000, 방향 6 → 표시 2000×3000: 폭 2000 이라 축소 대상 아님
        expect(fitsWithoutResize(jpeg(3000, 2000, exifOrientation(6)))).toBe(true);
        expect(fitsWithoutResize(jpeg(3000, 2000, exifOrientation(8)))).toBe(true);
        // 방향 1 이면 원시 폭 3000 그대로 → 축소 대상
        expect(fitsWithoutResize(jpeg(3000, 2000))).toBe(false);
        // 원시 2000×3000, 방향 6 → 표시 폭 3000 → 축소 대상
        expect(fitsWithoutResize(jpeg(2000, 3000, exifOrientation(6)))).toBe(false);
    });

    it('치수를 판정할 수 없으면 직행하지 않는다', () => {
        expect(fitsWithoutResize(build(soi, app0, scan))).toBe(false);
        expect(fitsWithoutResize(latin1('\x89PNG\r\n\x1a\n....'))).toBe(false);
        expect(fitsWithoutResize(new Uint8Array(0))).toBe(false);
    });
});

describe('prepareDirectJpeg', () => {
    it('메타데이터를 지운 바이트를 돌려준다', () => {
        const out = prepareDirectJpeg(jpeg(1200, 900, gpsXmp, exifOrientation(6)));
        expect(out).not.toBeNull();
        const bytes = Buffer.from(out ?? new Uint8Array(0));
        expect(bytes.includes(Buffer.from('GPSLatitude'))).toBe(false);
        expect(bytes.includes(Buffer.from(orientationSegment(6)))).toBe(true);
    });

    it('지울 것이 없으면 원본 그대로', () => {
        const input = jpeg(1200, 900);
        expect(prepareDirectJpeg(input)).toBe(input);
    });

    it('축소 대상이면 null(현행 경로)', () => {
        expect(prepareDirectJpeg(jpeg(4032, 3024, gpsXmp))).toBeNull();
    });

    it('구조가 깨졌으면 null(현행 경로)', () => {
        const broken = build(soi, app0, sof0(100, 100), new Uint8Array([0xff, 0xe1, 0xff, 0xff]));
        expect(prepareDirectJpeg(broken)).toBeNull();
    });
});
