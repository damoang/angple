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
 */

/** 활성 SSE 연결 관리 */
const connections = new Map<string, ReadableStreamDefaultController>();

/** 접속자 수 */
export function _getOnlineCount(): number {
    return connections.size;
}

/** 특정 사용자에게 알림 push */
export function _pushNotification(
    userId: string,
    data: { type: string; title: string; content: string; url?: string }
): void {
    const controller = connections.get(userId);
    if (controller) {
        try {
            const event = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(event));
        } catch {
            connections.delete(userId);
        }
    }
}

/** 전체 접속자에게 접속자 수 broadcast */
function broadcastOnlineCount(): void {
    const count = connections.size;
    const event = `event: online_count\ndata: ${count}\n\n`;
    const encoded = new TextEncoder().encode(event);

    for (const [userId, controller] of connections) {
        try {
            controller.enqueue(encoded);
        } catch {
            connections.delete(userId);
        }
    }
}

export const GET: RequestHandler = async ({ locals }) => {
    // 인증된 사용자만 SSE 연결 허용
    const userId = locals.user?.nickname || `anon-${Date.now()}`;

    const stream = new ReadableStream({
        start(controller) {
            // 연결 등록
            connections.set(userId, controller);

            // 초기 접속자 수 전송
            const initEvent = `event: online_count\ndata: ${connections.size}\n\n`;
            controller.enqueue(new TextEncoder().encode(initEvent));

            // 접속자 수 변경 broadcast
            broadcastOnlineCount();

            // 30초마다 heartbeat 전송 (연결 유지)
            const heartbeatInterval = setInterval(() => {
                try {
                    const heartbeat = `event: heartbeat\ndata: ${Date.now()}\n\n`;
                    controller.enqueue(new TextEncoder().encode(heartbeat));
                } catch {
                    clearInterval(heartbeatInterval);
                    connections.delete(userId);
                }
            }, 30000);

            // 연결 종료 시 정리 (controller가 close/error 될 때)
            // ReadableStream cancel 시 호출됨
        },
        cancel() {
            connections.delete(userId);
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
