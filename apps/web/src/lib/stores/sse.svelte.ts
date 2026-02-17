/**
 * SSE (Server-Sent Events) 스토어
 *
 * 실시간 알림 스트림 + 접속자 수 관리.
 * EventSource 연결을 관리하고, 폴링 폴백을 제공합니다.
 */

import { browser } from '$app/environment';

interface SSENotification {
    type: string;
    title: string;
    content: string;
    url?: string;
}

type NotificationHandler = (notification: SSENotification) => void;

class SSEStore {
    /** 접속자 수 */
    onlineCount = $state(0);

    /** 연결 상태 */
    isConnected = $state(false);

    /** 새 알림 핸들러 */
    private handlers: NotificationHandler[] = [];
    private eventSource: EventSource | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 3000;

    /** SSE 연결 시작 */
    connect(): void {
        if (!browser || this.eventSource) return;

        try {
            this.eventSource = new EventSource('/api/notifications/stream');

            this.eventSource.onopen = () => {
                this.isConnected = true;
                this.reconnectDelay = 3000; // 성공 시 딜레이 리셋
            };

            // 접속자 수 이벤트
            this.eventSource.addEventListener('online_count', (e) => {
                this.onlineCount = parseInt(e.data, 10) || 0;
            });

            // 알림 이벤트
            this.eventSource.addEventListener('notification', (e) => {
                try {
                    const notification: SSENotification = JSON.parse(e.data);
                    for (const handler of this.handlers) {
                        handler(notification);
                    }
                } catch {
                    // JSON 파싱 실패 무시
                }
            });

            this.eventSource.onerror = () => {
                this.isConnected = false;
                this.cleanup();
                this.scheduleReconnect();
            };
        } catch {
            this.scheduleReconnect();
        }
    }

    /** SSE 연결 종료 */
    disconnect(): void {
        this.cleanup();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /** 알림 핸들러 등록 */
    onNotification(handler: NotificationHandler): () => void {
        this.handlers.push(handler);
        return () => {
            this.handlers = this.handlers.filter((h) => h !== handler);
        };
    }

    private cleanup(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.isConnected = false;
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
        // 지수 백오프 (최대 60초)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
    }
}

export const sseStore = new SSEStore();
