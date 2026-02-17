/**
 * AI 콘텐츠 분석 유틸리티
 *
 * - 게시글 자동 요약 (OpenAI / Anthropic)
 * - AI 기반 스팸 점수 산정
 * - 콘텐츠 분류 (카테고리 추천)
 */

/** AI 제공자 설정 */
interface AIProviderConfig {
    provider: 'openai' | 'anthropic';
    apiKey: string;
}

/** 요약 결과 */
export interface SummaryResult {
    summary: string;
    keywords: string[];
    category?: string;
}

/** 스팸 분석 결과 */
export interface AISpamResult {
    score: number; // 0.0 ~ 1.0 (1.0 = 확실한 스팸)
    isSpam: boolean;
    reason?: string;
}

/**
 * 관리자 설정에서 AI API 키 로드
 */
function getAIConfig(): AIProviderConfig | null {
    // 환경변수에서 직접 로드 (관리자 설정 API를 통한 로드도 가능)
    const openaiKey = process.env.OPENAI_API_KEY || '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

    if (openaiKey) {
        return { provider: 'openai', apiKey: openaiKey };
    }
    if (anthropicKey) {
        return { provider: 'anthropic', apiKey: anthropicKey };
    }
    return null;
}

/**
 * OpenAI API 호출
 */
async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 300,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * Anthropic API 호출
 */
async function callAnthropic(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
}

/**
 * AI 제공자에 따라 API 호출
 */
async function callAI(
    config: AIProviderConfig,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    if (config.provider === 'openai') {
        return callOpenAI(config.apiKey, systemPrompt, userPrompt);
    }
    return callAnthropic(config.apiKey, systemPrompt, userPrompt);
}

/**
 * 게시글 자동 요약
 */
export async function summarizeContent(
    title: string,
    content: string
): Promise<SummaryResult | null> {
    const config = getAIConfig();
    if (!config) return null;

    const plainContent = content.replace(/<[^>]*>/g, ' ').trim();
    if (plainContent.length < 100) return null; // 너무 짧은 콘텐츠는 요약 불필요

    const systemPrompt =
        '한국어 커뮤니티 게시글을 분석합니다. JSON 형식으로만 응답하세요: {"summary": "2-3문장 요약", "keywords": ["키워드1", "키워드2", "키워드3"], "category": "카테고리"}';
    const userPrompt = `제목: ${title}\n\n본문: ${plainContent.slice(0, 2000)}`;

    try {
        const result = await callAI(config, systemPrompt, userPrompt);
        const parsed = JSON.parse(result);
        return {
            summary: parsed.summary || '',
            keywords: parsed.keywords || [],
            category: parsed.category
        };
    } catch (err) {
        console.error('[AI] 요약 실패:', err);
        return null;
    }
}

/**
 * AI 기반 스팸 점수 분석
 * 기존 규칙 기반 필터 + AI 보조 판정
 */
export async function analyzeSpamWithAI(
    title: string,
    content: string
): Promise<AISpamResult | null> {
    const config = getAIConfig();
    if (!config) return null;

    const plainContent = content.replace(/<[^>]*>/g, ' ').trim();
    const systemPrompt =
        '커뮤니티 게시글의 스팸 여부를 분석합니다. JSON으로만 응답: {"score": 0.0~1.0, "isSpam": true/false, "reason": "판정 이유"}. score 0.7 이상이면 isSpam=true.';
    const userPrompt = `제목: ${title}\n\n본문: ${plainContent.slice(0, 1000)}`;

    try {
        const result = await callAI(config, systemPrompt, userPrompt);
        const parsed = JSON.parse(result);
        return {
            score: parsed.score ?? 0,
            isSpam: parsed.isSpam ?? false,
            reason: parsed.reason
        };
    } catch (err) {
        console.error('[AI] 스팸 분석 실패:', err);
        return null;
    }
}
