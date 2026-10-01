import { describe, it, expect } from 'vitest';
import { isAwsS3Endpoint, resolveDirectUpload } from './storage-mode';

const R2 = 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com';
const AWS = 'https://s3.ap-northeast-2.amazonaws.com';

describe('isAwsS3Endpoint', () => {
    it('AWS S3 주소를 알아본다', () => {
        expect(isAwsS3Endpoint(AWS)).toBe(true);
        expect(isAwsS3Endpoint('https://s3.amazonaws.com')).toBe(true);
        expect(isAwsS3Endpoint('https://my-bucket.s3.us-east-1.amazonaws.com')).toBe(true);
        expect(isAwsS3Endpoint('https://S3.AP-NORTHEAST-2.AMAZONAWS.COM')).toBe(true);
    });

    it('S3 호환 저장소는 AWS 가 아니다', () => {
        expect(isAwsS3Endpoint(R2)).toBe(false);
        expect(isAwsS3Endpoint('http://minio:9000')).toBe(false);
        expect(isAwsS3Endpoint('https://storage.example.com')).toBe(false);
    });

    it('이름만 비슷한 호스트에 속지 않는다', () => {
        expect(isAwsS3Endpoint('https://amazonaws.com.evil.example')).toBe(false);
        expect(isAwsS3Endpoint('https://notamazonaws.com')).toBe(false);
    });

    it('빈 값·잘못된 값', () => {
        expect(isAwsS3Endpoint('')).toBe(false);
        expect(isAwsS3Endpoint('not a url')).toBe(false);
    });
});

describe('resolveDirectUpload', () => {
    // ⛔ 이 한 줄이 회귀 시험의 본체다. AWS 주소를 적어 둔 사이트가 직접 업로드로 판정되면
    //    Lambda 가 호출되지 않아 썸네일·WebP·R2 기록이 조용히 멈춘다.
    it('AWS endpoint 를 적어 둔 사이트는 Lambda 파이프라인을 탄다', () => {
        expect(resolveDirectUpload(AWS, undefined)).toBe(false);
        expect(resolveDirectUpload(AWS, '')).toBe(false);
    });

    it('endpoint 가 없으면 Lambda 파이프라인(AWS 기본)', () => {
        expect(resolveDirectUpload('', undefined)).toBe(false);
    });

    it('R2·MinIO 단독 사이트는 플래그 없이도 직접 업로드', () => {
        expect(resolveDirectUpload(R2, undefined)).toBe(true);
        expect(resolveDirectUpload('http://minio:9000', undefined)).toBe(true);
    });

    it('명시한 플래그가 항상 우선한다', () => {
        expect(resolveDirectUpload(AWS, 'true')).toBe(true);
        expect(resolveDirectUpload('', 'true')).toBe(true);
        expect(resolveDirectUpload(R2, 'false')).toBe(false);
    });

    it('true/false 가 아닌 값은 명시로 보지 않는다', () => {
        expect(resolveDirectUpload(AWS, '1')).toBe(false);
        expect(resolveDirectUpload(R2, 'yes')).toBe(true);
    });
});

describe('isAwsS3Endpoint — 주소 모양이 달라도 알아본다', () => {
    // ⛔ 호스트 파싱을 문자열 비교로 「단순화」하면 이 블록이 잡는다.
    it('끝 슬래시·포트·경로가 붙은 AWS 주소', () => {
        expect(isAwsS3Endpoint(`${AWS}/`)).toBe(true);
        expect(isAwsS3Endpoint(`${AWS}:443`)).toBe(true);
        expect(isAwsS3Endpoint(`${AWS}:443/some/path`)).toBe(true);
        expect(resolveDirectUpload(`${AWS}/`, undefined)).toBe(false);
    });

    it('중국 리전과 끝에 점이 붙은 FQDN', () => {
        expect(isAwsS3Endpoint('https://s3.cn-north-1.amazonaws.com.cn')).toBe(true);
        expect(isAwsS3Endpoint('https://s3.ap-northeast-2.amazonaws.com.')).toBe(true);
    });

    it('스킴 없이 호스트만 적거나 따옴표·공백이 섞인 값', () => {
        expect(isAwsS3Endpoint('s3.ap-northeast-2.amazonaws.com')).toBe(true);
        expect(isAwsS3Endpoint(` "${AWS}" `)).toBe(true);
        expect(resolveDirectUpload('s3.ap-northeast-2.amazonaws.com', undefined)).toBe(false);
    });

    it('그래도 비슷한 이름에는 속지 않는다', () => {
        expect(isAwsS3Endpoint('https://amazonaws.com.cn.evil.example')).toBe(false);
        expect(isAwsS3Endpoint('minio:9000')).toBe(false);
        expect(resolveDirectUpload('minio:9000', undefined)).toBe(true);
    });
});

describe('resolveDirectUpload — 플래그 표기', () => {
    it('대소문자와 앞뒤 공백을 무시한다', () => {
        expect(resolveDirectUpload(R2, 'False')).toBe(false);
        expect(resolveDirectUpload(R2, ' FALSE ')).toBe(false);
        expect(resolveDirectUpload(AWS, 'TRUE')).toBe(true);
    });

    it('공백뿐인 endpoint 는 없는 것과 같다', () => {
        expect(resolveDirectUpload('   ', undefined)).toBe(false);
    });
});
