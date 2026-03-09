/**
 * JSON 응답 파싱 안전성 유틸리티
 *
 * nginx 502/503 HTML 에러 페이지 등 비정상 응답에서
 * response.json()이 SyntaxError를 던지는 문제를 방지합니다.
 */

/**
 * Response.json()을 안전하게 호출합니다.
 * content-type이 JSON이 아니거나 파싱 실패 시 명확한 에러를 던집니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeJson<T = any>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        const preview = text.slice(0, 120);
        throw new Error(
            `Expected JSON but got ${contentType || 'unknown content-type'} (HTTP ${response.status}): ${preview}`
        );
    }

    try {
        return await response.json();
    } catch {
        throw new Error(`JSON parse error (HTTP ${response.status})`);
    }
}

/**
 * XHR responseText를 안전하게 JSON 파싱합니다.
 * HTML 에러 페이지 등 비정상 응답에서 SyntaxError를 방지합니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeJsonParse<T = any>(text: string): T {
    try {
        return JSON.parse(text);
    } catch {
        const preview = text.slice(0, 120);
        throw new Error(`JSON parse error: ${preview}`);
    }
}
