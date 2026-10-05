import { describe, it, expect } from 'vitest';
import {
    buildLines,
    engineOf,
    isSampled,
    rateFor,
    shouldSend,
    statusOf
} from './comment-delete-telemetry';

describe('shouldSend / isSampled / rateFor', () => {
    it('fail 은 표본 밖이어도 보낸다', () => {
        expect(shouldSend('fail', false)).toBe(true);
        expect(rateFor('fail', false, 10)).toBe(1);
    });

    it('정상 단계는 표본일 때만 보낸다', () => {
        for (const stage of ['click', 'confirmed', 'cancelled', 'ok'] as const) {
            expect(shouldSend(stage, true)).toBe(true);
            expect(shouldSend(stage, false)).toBe(false);
        }
    });

    it('배율 1 이하는 항상 표본', () => {
        expect(isSampled(1, 0.99)).toBe(true);
        expect(isSampled(0, 0.5)).toBe(true);
    });

    it('배율 N 은 rand < 1/N 일 때만 표본', () => {
        expect(isSampled(4, 0.2)).toBe(true);
        expect(isSampled(4, 0.25)).toBe(false);
        expect(rateFor('click', true, 4)).toBe(4);
        expect(rateFor('fail', true, 4)).toBe(4);
        expect(rateFor('ok', true, 1)).toBe(1);
    });
});

describe('statusOf', () => {
    it('오류 객체의 status 를 우선한다', () => {
        expect(statusOf({ status: 403 })).toBe('403');
    });

    it('status 가 없으면 마지막 댓글 API 리소스의 responseStatus 를 쓴다', () => {
        const entries = [
            { name: 'https://x.test/api/boards/free/posts/1/comments/2', responseStatus: 500 },
            { name: 'https://x.test/static/app.js', responseStatus: 200 },
            { name: 'https://x.test/api/boards/free/posts/1/comments/3', responseStatus: 429 }
        ];
        expect(statusOf(new Error('x'), entries)).toBe('429');
    });

    it('responseStatus 를 지원하지 않으면 분류로 떨어진다', () => {
        const entries = [{ name: 'https://x.test/api/boards/free/posts/1/comments/2' }];
        expect(statusOf(new Error('x'), entries)).toBe('unknown');
        expect(statusOf(new TypeError('Failed to fetch'), entries)).toBe('network');
    });

    it('아무 정보도 없으면 unknown', () => {
        expect(statusOf(undefined)).toBe('unknown');
        expect(statusOf({ status: 0 })).toBe('unknown');
    });
});

describe('engineOf', () => {
    it('iPhone Safari 는 webkit-ios', () => {
        const ua =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1';
        expect(engineOf(ua)).toBe('webkit-ios');
    });

    it('데스크톱 크롬은 chromium', () => {
        const ua =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
        expect(engineOf(ua)).toBe('chromium');
    });
});

describe('buildLines', () => {
    const lines = buildLines({
        stage: 'fail',
        kind: 'delete',
        attempt: 'abc123',
        rate: 1,
        status: '403',
        nav: 'navigate',
        engine: 'webkit-ios',
        page: '/free/:id',
        ageS: 4500,
        sinceClickMs: 1800
    });

    it('정해진 키만 싣는다', () => {
        expect(lines.map((l) => l.split('=')[0])).toEqual([
            'stage',
            'kind',
            'attempt',
            'rate',
            'status',
            'nav',
            'engine',
            'page',
            'age_s',
            'since_click_ms'
        ]);
    });

    it('fail 줄에 상태 코드가 실린다', () => {
        expect(lines).toContain('status=403');
    });

    it('회원·댓글·글 식별자 키가 없다', () => {
        const joined = lines.join('\n');
        expect(joined).not.toMatch(/mb_id|member|comment_id|post_id|wr_id/);
    });
});
