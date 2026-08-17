/**
 * 플러그인 캐시 무효화 pub/sub — 발행 측 (Option C 2단계)
 *
 * 문제: 활성 플러그인 캐시(plugins/index.ts 의 TieredCache L1 + 각 provider 의 로컬 캐시)는
 *   **파드마다 따로** 존재한다. admin 이 한 파드에서 플러그인을 토글해도 나머지 파드는
 *   자기 L1 TTL 만큼 옛 값을 계속 쓴다. Redis DEL 만으로는 다른 파드의 in-memory L1 을 지울 수 없다.
 *
 * 해법: Redis pub/sub 으로 "무효화" 이벤트를 전 파드에 방송한다. 각 파드의 구독자
 *   (invalidation-subscriber.ts)가 이벤트를 받아 자기 로컬 캐시를 비운다.
 *
 * ⛔ best-effort — Redis 장애 시에도 throw 하지 않는다(토글 자체가 실패하면 안 된다).
 *    자기 파드는 이미 로컬에서 무효화하므로, 방송 실패는 "다른 파드가 최대 L1 TTL 지연"에 그친다.
 */

import { getRedis } from '$lib/server/redis';

/** 무효화 이벤트 타입. 지금은 활성 목록만이지만 확장 여지를 둔다. */
export interface PluginInvalidationMessage {
    /** 'active' = 활성 목록 변경, 'settings' = 특정 플러그인 설정 변경 */
    type: 'active' | 'settings';
    /** 대상 플러그인 ID (settings 타입에서 사용) */
    pluginId?: string;
    /** 발신 파드 식별자 — 구독자가 자기 방송을 무시(self-skip)하는 데 쓴다 */
    origin: string;
    /** 발행 시각(ms) */
    ts: number;
}

/** CACHE_NAMESPACE 가 있으면 접두해 canary/prod 가 공유 Redis 를 써도 채널이 섞이지 않게 한다. */
function channelName(): string {
    const ns = process.env.CACHE_NAMESPACE;
    return ns ? `${ns}:angple:plugin:invalidate` : 'angple:plugin:invalidate';
}

export const PLUGIN_INVALIDATION_CHANNEL = channelName();

/** 이 프로세스(파드)의 식별자. self-skip 용. */
export const POD_ID =
    process.env.HOSTNAME || process.env.POD_NAME || `pid-${process.pid}-${Date.now()}`;

/**
 * 플러그인 무효화 이벤트를 전 파드에 방송한다.
 * ⛔ best-effort — 실패해도 삼킨다.
 */
export async function publishPluginInvalidation(
    payload: Pick<PluginInvalidationMessage, 'type' | 'pluginId'>
): Promise<void> {
    const message: PluginInvalidationMessage = {
        type: payload.type,
        pluginId: payload.pluginId,
        origin: POD_ID,
        ts: Date.now()
    };
    try {
        await getRedis().publish(PLUGIN_INVALIDATION_CHANNEL, JSON.stringify(message));
    } catch (err) {
        console.error('[PluginInvalidation] publish 실패(무시):', err);
    }
}
