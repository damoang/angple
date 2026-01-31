/**
 * API 에러 타입 분류
 */

export type ApiErrorType =
    | 'network' // 네트워크 연결 실패
    | 'timeout' // 요청 타임아웃
    | 'auth' // 인증 실패 (401)
    | 'forbidden' // 권한 없음 (403)
    | 'not_found' // 리소스 없음 (404)
    | 'validation' // 유효성 검증 실패 (422)
    | 'rate_limit' // 요청 제한 (429)
    | 'server' // 서버 에러 (5xx)
    | 'unknown'; // 알 수 없는 에러

export class ApiRequestError extends Error {
    readonly type: ApiErrorType;
    readonly status?: number;
    readonly code?: string;
    readonly retryable: boolean;

    constructor(message: string, type: ApiErrorType, status?: number, code?: string) {
        super(message);
        this.name = 'ApiRequestError';
        this.type = type;
        this.status = status;
        this.code = code;
        this.retryable = ['network', 'timeout', 'server', 'rate_limit'].includes(type);
    }

    static fromStatus(status: number, message?: string, code?: string): ApiRequestError {
        const type = classifyHttpStatus(status);
        return new ApiRequestError(message || `HTTP ${status}`, type, status, code);
    }

    static network(message = '네트워크 연결에 실패했습니다.'): ApiRequestError {
        return new ApiRequestError(message, 'network');
    }

    static timeout(message = '요청 시간이 초과되었습니다.'): ApiRequestError {
        return new ApiRequestError(message, 'timeout');
    }
}

function classifyHttpStatus(status: number): ApiErrorType {
    if (status === 401) return 'auth';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 422) return 'validation';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server';
    return 'unknown';
}
