/**
 * Circuit Breaker — 백엔드 장애 시 즉시 차단하여 cascading failure 방지
 *
 * 상태 전이:
 *   CLOSED → (failureThreshold 연속 실패) → OPEN → (resetTimeout 경과) → HALF_OPEN → (probe 성공) → CLOSED
 *                                                                                   (probe 실패) → OPEN
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;
    private readonly failureThreshold: number;
    private readonly resetTimeoutMs: number;

    constructor(
        private readonly name: string,
        options?: { failureThreshold?: number; resetTimeoutMs?: number }
    ) {
        this.failureThreshold = options?.failureThreshold ?? 5;
        this.resetTimeoutMs = options?.resetTimeoutMs ?? 30_000;
    }

    /** 요청 허용 여부. OPEN 상태에서는 즉시 false 반환. */
    canRequest(): boolean {
        if (this.state === 'CLOSED') return true;

        if (this.state === 'OPEN') {
            // resetTimeout 경과 시 HALF_OPEN으로 전환 (probe 1건 허용)
            if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
                return true;
            }
            return false;
        }

        // HALF_OPEN: probe 1건 허용 (이미 HALF_OPEN이면 추가 요청 차단)
        return true;
    }

    /** 성공 기록 → CLOSED 복귀 */
    recordSuccess(): void {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            console.log(`[CircuitBreaker:${this.name}] HALF_OPEN → CLOSED (recovered)`);
        }
    }

    /** 실패 기록 → threshold 초과 시 OPEN 전환 */
    recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            console.warn(`[CircuitBreaker:${this.name}] HALF_OPEN → OPEN (probe failed)`);
            return;
        }

        if (this.failureCount >= this.failureThreshold && this.state === 'CLOSED') {
            this.state = 'OPEN';
            console.warn(
                `[CircuitBreaker:${this.name}] CLOSED → OPEN (${this.failureCount} failures)`
            );
        }
    }

    getState(): CircuitState {
        return this.state;
    }
}

/** 글로벌 백엔드 Circuit Breaker (싱글톤) */
export const backendCircuitBreaker = new CircuitBreaker('backend', {
    failureThreshold: 5,
    resetTimeoutMs: 30_000
});
