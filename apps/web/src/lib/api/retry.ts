/**
 * API 재시도 및 타임아웃 유틸리티
 */

import { ApiRequestError } from './errors';

export interface RetryConfig {
	/** 최대 재시도 횟수 (기본: 2) */
	maxRetries: number;
	/** 기본 대기 시간 ms (기본: 1000) */
	baseDelay: number;
	/** 요청 타임아웃 ms (기본: 15000) */
	timeout: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 2,
	baseDelay: 1000,
	timeout: 15000
};

/** 지수 백오프 딜레이 계산 */
function getDelay(attempt: number, baseDelay: number): number {
	// 지수 백오프 + 지터 (0~500ms)
	return baseDelay * Math.pow(2, attempt) + Math.random() * 500;
}

/** 타임아웃이 적용된 fetch */
export async function fetchWithTimeout(
	url: string,
	options: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});
		return response;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw ApiRequestError.timeout();
		}
		throw ApiRequestError.network();
	} finally {
		clearTimeout(timeoutId);
	}
}

/** 재시도 가능한 fetch 래퍼 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit,
	config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			const response = await fetchWithTimeout(url, options, config.timeout);

			// 재시도 가능한 서버 에러인 경우
			if (response.status >= 500 && attempt < config.maxRetries) {
				lastError = ApiRequestError.fromStatus(response.status);
				await sleep(getDelay(attempt, config.baseDelay));
				continue;
			}

			// 429 Rate Limit
			if (response.status === 429 && attempt < config.maxRetries) {
				const retryAfter = response.headers.get('Retry-After');
				const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : getDelay(attempt, config.baseDelay);
				await sleep(delay);
				continue;
			}

			return response;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// 네트워크/타임아웃 에러는 재시도
			if (
				error instanceof ApiRequestError &&
				error.retryable &&
				attempt < config.maxRetries
			) {
				await sleep(getDelay(attempt, config.baseDelay));
				continue;
			}

			throw error;
		}
	}

	throw lastError || new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
