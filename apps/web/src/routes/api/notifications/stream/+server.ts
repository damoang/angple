import type { RequestHandler } from './$types.js';

/**
 * SSE 알림 스트림
 *
 * GET /api/notifications/stream
 *
 * Server-Sent Events 기반 실시간 알림 스트림.
 * 클라이언트가 EventSource로 연결하면, 서버가 새 알림/접속자 수를 실시간 push.
 *
 * 이벤트 타입:
 * - notification: 새 알림 (data: JSON)
 * - online_count: 접속자 수 (data: number)
 * - heartbeat: 연결 유지 ping (data: timestamp)
 *
 * ## 누수 방지 (2026-04-28)
 * Tier 3 audit (Plan agent) 의 진단:
 * - 클라이언트 갑작 종료 시 cancel() 미호출 → controller + heartbeatInterval closure 영원히 retain
 * - hot pod 만 SSE sticky 분산 → p95-only 누수 패턴 정확 매치
 *
 * 5가지 hardening:
 * 1. SSEEntry struct 로 controller + heartbeatInterval + lastActivity 묶음 (cancel/cleanup 모두에서 clear 가능)
 * 2. cap MAX_CONNECTIONS 도달 시 oldest forced close (insertion order)
 * 3. module-level cleanup interval (60s) — idle 5분 초과 entry 강제 close
 * 4. enqueue 실패 시 controller.close() + delete (silent retain 차단)
 * 5. 익명 키는 그대로 두되 idle/cap 으로 처리 (UX 호환)
 */

interface SSEEntry {
    controller: ReadableStreamDefaultController;
    heartbeatInterval: ReturnType<typeof setInterval>;
    lastActivity: number;
}

/** 활성 SSE 연결 관리 */
const connections = new Map<string, SSEEntry>();

const MAX_CONNECTIONS = 5_000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5분 (heartbeat 30초 × 10)
const CLEANUP_INTERVAL_MS = 60_000; // 1분마다 idle sweep

/** entry 강제 종료 (heartbeat clear + controller close + delete) */
function closeEntry(userId: string, entry: SSEEntry): void {
    clearInterval(entry.heartbeatInterval);
    try {
        entry.controller.close();
    } catch {
        // 이미 닫혀있으면 무시
    }
    connections.delete(userId);
}

/** 접속자 수 */
export function _getOnlineCount(): number {
    return connections.size;
}

/** 특정 사용자에게 알림 push */
export function _pushNotification(
    userId: string,
    data: { type: string; title: string; content: string; url?: string }
): void {
    const entry = connections.get(userId);
    if (entry) {
        try {
            const event = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;
            entry.controller.enqueue(new TextEncoder().encode(event));
            entry.lastActivity = Date.now();
        } catch {
            closeEntry(userId, entry);
        }
    }
}

/** 전체 접속자에게 접속자 수 broadcast */
function broadcastOnlineCount(): void {
    const count = connections.size;
    const event = `event: online_count\ndata: ${count}\n\n`;
    const encoded = new TextEncoder().encode(event);

    for (const [userId, entry] of connections) {
        try {
            entry.controller.enqueue(encoded);
            entry.lastActivity = Date.now();
        } catch {
            closeEntry(userId, entry);
        }
    }
}

/**
 * Idle 연결 sweep (60s 주기).
 * 5분 이상 lastActivity 없으면 강제 close — 클라이언트 갑작 종료 (cancel 미호출) 누수 방지.
 */
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of connections) {
        if (now - entry.lastActivity > IDLE_TIMEOUT_MS) {
            closeEntry(userId, entry);
        }
    }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

export const GET: RequestHandler = async ({ locals }) => {
    // 인증된 사용자: nickname / 비인증: 시각 기반 익명 (재접속 시 새 entry — idle/cap 으로 정리)
    const userId = locals.user?.nickname || `anon-${Date.now()}`;

    const stream = new ReadableStream({
        start(controller) {
            // Cap 도달 시 oldest 강제 close (insertion order, 새 연결 우선)
            if (connections.size >= MAX_CONNECTIONS) {
                const oldestKey = connections.keys().next().value;
                if (oldestKey !== undefined) {
                    const oldestEntry = connections.get(oldestKey);
                    if (oldestEntry) closeEntry(oldestKey, oldestEntry);
                }
            }

            // 같은 userId 기존 entry 있으면 강제 close (재접속 시 stale 정리)
            const existing = connections.get(userId);
            if (existing) closeEntry(userId, existing);

            // 30초마다 heartbeat (연결 유지)
            const heartbeatInterval = setInterval(() => {
                const entry = connections.get(userId);
                if (!entry) {
                    clearInterval(heartbeatInterval);
                    return;
                }
                try {
                    const heartbeat = `event: heartbeat\ndata: ${Date.now()}\n\n`;
                    entry.controller.enqueue(new TextEncoder().encode(heartbeat));
                    entry.lastActivity = Date.now();
                } catch {
                    closeEntry(userId, entry);
                }
            }, 30_000);
            heartbeatInterval.unref?.();

            connections.set(userId, {
                controller,
                heartbeatInterval,
                lastActivity: Date.now()
            });

            // 초기 접속자 수 전송
            const initEvent = `event: online_count\ndata: ${connections.size}\n\n`;
            controller.enqueue(new TextEncoder().encode(initEvent));

            // 접속자 수 변경 broadcast
            broadcastOnlineCount();
        },
        cancel() {
            const entry = connections.get(userId);
            if (entry) closeEntry(userId, entry);
            broadcastOnlineCount();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no' // nginx proxy buffering 비활성화
        }
    });
};
