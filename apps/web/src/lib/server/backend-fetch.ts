/**
 * Backend Fetch Wrapper — 모든 서버사이드 Go 백엔드 fetch를 감싸는 표준 래퍼
 *
 * 기능:
 * - 기본 timeout 15초 (AbortSignal.timeout)
 * - Circuit breaker 자동 연동
 * - 5xx 응답 시 failure 카운트
 * - 구조화된 에러 (BackendUnavailableError)
 */

import { env } from '$env/dynamic/private';
import { backendCircuitBreaker } from './circuit-breaker.js';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';
const DEFAULT_TIMEOUT_MS = 15_000;

export class BackendUnavailableError extends Error {
    readonly status = 503;
    constructor(message = '백엔드 서비스를 일시적으로 사용할 수 없습니다.') {
        super(message);
        this.name = 'BackendUnavailableError';
    }
}

export interface BackendFetchOptions {
    /** 요청 timeout (ms). 기본 15000ms */
    timeout?: number;
    /** HTTP 헤더 */
    headers?: Record<string, string>;
    /** HTTP 메서드 */
    method?: string;
    /** 요청 body */
    body?: BodyInit | null;
    /** circuit breaker 우회 (health check 등에 사용) */
    bypassCircuitBreaker?: boolean;
}

/**
 * Go 백엔드로의 서버사이드 fetch.
 * Circuit breaker + timeout 자동 적용.
 *
 * @param path - API 경로 (예: `/api/v1/boards/free/posts`)
 * @param options - fetch 옵션
 * @returns Response 객체
 * @throws BackendUnavailableError — circuit breaker OPEN 상태 또는 연결 실패 시
 */
export async function backendFetch(path: string, options?: BackendFetchOptions): Promise<Response> {
    const {
        timeout = DEFAULT_TIMEOUT_MS,
        headers,
        method,
        body,
        bypassCircuitBreaker
    } = options ?? {};

    // Circuit breaker 체크
    if (!bypassCircuitBreaker && !backendCircuitBreaker.canRequest()) {
        throw new BackendUnavailableError();
    }

    // URL 조합: 절대 URL이면 그대로, 상대 경로면 BACKEND_URL 붙임
    const url = path.startsWith('http') ? path : `${BACKEND_URL}${path}`;

    try {
        const response = await globalThis.fetch(url, {
            method: method ?? 'GET',
            headers,
            body,
            signal: AbortSignal.timeout(timeout)
        });

        // 5xx → circuit breaker failure
        if (response.status >= 500) {
            backendCircuitBreaker.recordFailure();
        } else {
            backendCircuitBreaker.recordSuccess();
        }

        return response;
    } catch (err) {
        // timeout 또는 네트워크 에러
        backendCircuitBreaker.recordFailure();

        if (err instanceof DOMException && err.name === 'TimeoutError') {
            throw new BackendUnavailableError(`백엔드 응답 시간 초과 (${timeout}ms)`);
        }

        throw new BackendUnavailableError(err instanceof Error ? err.message : '백엔드 연결 실패');
    }
}

/**
 * 인증 헤더가 포함된 백엔드 fetch 헬퍼.
 * locals.accessToken이 있으면 Authorization 헤더 자동 주입.
 */
export function createAuthHeaders(accessToken?: string | null): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Angple-Web-SSR/1.0'
    };
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
}
