import { describe, it, expect, beforeEach, vi } from 'vitest';
import { summarizeContent, analyzeSpamWithAI } from './ai-content';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeSuccessResponse(body: object) {
    return {
        ok: true,
        json: () => Promise.resolve(body)
    };
}

function makeErrorResponse(status: number) {
    return {
        ok: false,
        status
    };
}

// 100자 이상 콘텐츠 (summarizeContent의 최소 길이 조건 충족)
const longContent =
    '<p>' + '테스트 콘텐츠입니다. 이 글은 충분히 긴 본문을 만들기 위해 작성되었습니다. '.repeat(5) + '</p>';
const shortContent = '<p>짧은 글</p>';

describe('summarizeContent', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        mockFetch.mockReset();
    });

    it('콘텐츠가 100자 미만이면 null 반환', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        const result = await summarizeContent('제목', shortContent);
        expect(result).toBeNull();
    });

    it('API 키가 없으면 null 반환', async () => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;

        const result = await summarizeContent('제목', longContent);
        expect(result).toBeNull();
    });

    it('성공 시 파싱된 결과 반환 (OpenAI)', async () => {
        process.env.OPENAI_API_KEY = 'test-openai-key';
        delete process.env.ANTHROPIC_API_KEY;

        const aiResponse = {
            summary: '이것은 요약입니다.',
            keywords: ['테스트', '콘텐츠'],
            category: '일반'
        };

        mockFetch.mockResolvedValueOnce(
            makeSuccessResponse({
                choices: [
                    {
                        message: {
                            content: JSON.stringify(aiResponse)
                        }
                    }
                ]
            })
        );

        const result = await summarizeContent('테스트 제목', longContent);

        expect(result).not.toBeNull();
        expect(result!.summary).toBe('이것은 요약입니다.');
        expect(result!.keywords).toEqual(['테스트', '콘텐츠']);
        expect(result!.category).toBe('일반');
    });

    it('API 오류 시 null 반환', async () => {
        process.env.OPENAI_API_KEY = 'test-openai-key';
        delete process.env.ANTHROPIC_API_KEY;

        mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await summarizeContent('제목', longContent);

        expect(result).toBeNull();
        consoleSpy.mockRestore();
    });

    it('Anthropic 키가 있으면 Anthropic API 호출', async () => {
        delete process.env.OPENAI_API_KEY;
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

        const aiResponse = {
            summary: 'Anthropic 요약',
            keywords: ['AI'],
            category: '기술'
        };

        mockFetch.mockResolvedValueOnce(
            makeSuccessResponse({
                content: [{ text: JSON.stringify(aiResponse) }]
            })
        );

        const result = await summarizeContent('테스트', longContent);

        expect(result).not.toBeNull();
        expect(result!.summary).toBe('Anthropic 요약');
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.anthropic.com/v1/messages',
            expect.objectContaining({
                method: 'POST'
            })
        );
    });
});

describe('analyzeSpamWithAI', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        mockFetch.mockReset();
    });

    it('API 키가 없으면 null 반환', async () => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;

        const result = await analyzeSpamWithAI('스팸 제목', '스팸 내용');
        expect(result).toBeNull();
    });

    it('성공 시 파싱된 결과 반환', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        delete process.env.ANTHROPIC_API_KEY;

        const spamResult = {
            score: 0.9,
            isSpam: true,
            reason: '광고성 콘텐츠'
        };

        mockFetch.mockResolvedValueOnce(
            makeSuccessResponse({
                choices: [
                    {
                        message: {
                            content: JSON.stringify(spamResult)
                        }
                    }
                ]
            })
        );

        const result = await analyzeSpamWithAI('광고!!!', '<p>지금 바로 클릭하세요!</p>');

        expect(result).not.toBeNull();
        expect(result!.score).toBe(0.9);
        expect(result!.isSpam).toBe(true);
        expect(result!.reason).toBe('광고성 콘텐츠');
    });

    it('JSON 파싱 오류 시 null 반환', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        delete process.env.ANTHROPIC_API_KEY;

        mockFetch.mockResolvedValueOnce(
            makeSuccessResponse({
                choices: [
                    {
                        message: {
                            content: '이것은 유효하지 않은 JSON입니다'
                        }
                    }
                ]
            })
        );

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await analyzeSpamWithAI('제목', '본문');

        expect(result).toBeNull();
        consoleSpy.mockRestore();
    });

    it('스팸이 아닌 콘텐츠 분석', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        delete process.env.ANTHROPIC_API_KEY;

        const spamResult = {
            score: 0.1,
            isSpam: false,
            reason: '정상적인 게시글'
        };

        mockFetch.mockResolvedValueOnce(
            makeSuccessResponse({
                choices: [
                    {
                        message: {
                            content: JSON.stringify(spamResult)
                        }
                    }
                ]
            })
        );

        const result = await analyzeSpamWithAI('일반 게시글', '<p>안녕하세요</p>');

        expect(result).not.toBeNull();
        expect(result!.score).toBe(0.1);
        expect(result!.isSpam).toBe(false);
    });
});
