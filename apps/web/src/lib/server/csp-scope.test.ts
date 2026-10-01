import { describe, it, expect } from 'vitest';
import { shouldSendCsp } from './csp-scope';

describe('shouldSendCsp', () => {
    it('데이터 응답에는 붙이지 않는다', () => {
        expect(shouldSendCsp('application/json')).toBe(false);
        expect(shouldSendCsp('application/json; charset=utf-8')).toBe(false);
        expect(shouldSendCsp('Application/JSON')).toBe(false);
        expect(shouldSendCsp('text/sveltekit-data')).toBe(false);
    });

    it('문서에는 붙인다', () => {
        expect(shouldSendCsp('text/html')).toBe(true);
        expect(shouldSendCsp('text/html; charset=utf-8')).toBe(true);
    });

    // ⛔ 브라우저가 문서로 열어 스크립트를 실행할 수 있는 유형. 여기서 빠지면 보안 회귀다.
    it('문서로 열릴 수 있는 유형에는 붙인다', () => {
        expect(shouldSendCsp('image/svg+xml')).toBe(true);
        expect(shouldSendCsp('application/xml')).toBe(true);
        expect(shouldSendCsp('text/xml')).toBe(true);
        expect(shouldSendCsp('application/xhtml+xml')).toBe(true);
        expect(shouldSendCsp('application/rss+xml')).toBe(true);
        expect(shouldSendCsp('text/javascript')).toBe(true);
    });

    it('모르는 유형·유형 없음은 붙이는 쪽으로', () => {
        expect(shouldSendCsp(null)).toBe(true);
        expect(shouldSendCsp(undefined)).toBe(true);
        expect(shouldSendCsp('')).toBe(true);
        expect(shouldSendCsp('application/octet-stream')).toBe(true);
    });

    it('이름만 비슷한 유형은 데이터 응답으로 보지 않는다', () => {
        expect(shouldSendCsp('application/json-seq')).toBe(true);
        expect(shouldSendCsp('application/ld+json')).toBe(true);
        expect(shouldSendCsp('text/html; note=application/json')).toBe(true);
    });
});
