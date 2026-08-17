/**
 * 플러그인 캐시 무효화 pub/sub — 구독 측 (Option C 2단계)
 *
 * 각 파드에서 부팅 시 1회 구독을 시작한다(hooks.server.ts). 다른 파드가 플러그인을
 * 토글/설정변경하면 invalidation.ts 가 방송하고, 여기서 받아 이 파드의 로컬 캐시를 비운다:
 *   1) activePluginsTieredCache 의 L1 (deleteL1) — L2(Redis)는 발행 파드가 이미 지웠다.
 *   2) pluginSettingsProvider.invalidateLocal() — DB provider 의 프로세스 로컬 캐시.
 *   3) invalidateHandlerCache() — 라우트 디스패처 핸들러 캐시.
 *
 * ⛔ 구독 전용 커넥션(getRedis().duplicate())을 쓴다 — ioredis 는 subscribe 상태의
 *    커넥션에서 일반 명령을 못 쓴다. 메인 커넥션을 구독에 쓰면 다른 캐시 get/set 이 막힌다.
 * ⛔ 멱등 — 모듈 플래그로 중복 초기화를 막는다(HMR/중복 import 대비).
 * ⛔ self-skip — 자기 파드가 방송한 이벤트는 무시한다(이미 로컬에서 무효화했다).
 * best-effort — Redis 장애로 구독이 실패해도 앱은 계속 뜬다(파드 간 지연으로 열화될 뿐).
 */

import type Redis from 'ioredis';
import { getRedis } from '$lib/server/redis';
import { activePluginsTieredCache } from './index';
import { invalidateHandlerCache } from './route-dispatcher';
import { pluginSettingsProvider } from '$lib/server/settings/plugin-settings-provider';
import {
    PLUGIN_INVALIDATION_CHANNEL,
    POD_ID,
    type PluginInvalidationMessage
} from './invalidation';

let initialized = false;
let subscriber: Redis | null = null;

/** 방송을 받아 이 파드의 로컬 캐시를 비운다. */
function applyInvalidation(msg: PluginInvalidationMessage): void {
    // 자기 파드가 보낸 방송은 무시(이미 로컬 무효화 완료)
    if (msg.origin === POD_ID) return;

    // 활성 목록 L1 은 'list' 키에 담긴다(plugins/index.ts). L2 는 발행 파드가 이미 DEL.
    activePluginsTieredCache.deleteL1('list');

    // DB provider 의 프로세스 로컬 캐시 비우기(구현이 있을 때만)
    pluginSettingsProvider.invalidateLocal?.();

    // 라우트 핸들러 캐시(활성 플러그인 변화 → 라우트 매핑 변화 가능)
    invalidateHandlerCache();
}

/**
 * 플러그인 무효화 구독 시작. 부팅 시 1회 호출(멱등).
 */
export function initPluginInvalidationSubscriber(): void {
    if (initialized) return;
    initialized = true;

    try {
        // 구독 전용 커넥션 — 메인 커넥션은 일반 명령용으로 남겨둔다.
        subscriber = getRedis().duplicate();

        subscriber.on('error', (err: Error) => {
            console.error('[PluginInvalidation] 구독 커넥션 오류:', err.message);
        });

        // reconnect(ready) 시마다 재구독 — 커넥션이 끊겼다 붙으면 구독이 풀린다.
        subscriber.on('ready', () => {
            subscriber?.subscribe(PLUGIN_INVALIDATION_CHANNEL).catch((err: Error) => {
                console.error('[PluginInvalidation] subscribe 실패:', err.message);
            });
        });

        subscriber.on('message', (channel: string, raw: string) => {
            if (channel !== PLUGIN_INVALIDATION_CHANNEL) return;
            try {
                const msg = JSON.parse(raw) as PluginInvalidationMessage;
                applyInvalidation(msg);
            } catch (err) {
                console.error('[PluginInvalidation] 메시지 파싱 실패:', err);
            }
        });

        // lazyConnect 커넥션을 깨운다. 연결되면 'ready' 에서 subscribe 한다.
        subscriber.connect().catch((err: Error) => {
            // 이미 연결 중이면 무해한 에러가 날 수 있다.
            if (!/already/i.test(err.message)) {
                console.error('[PluginInvalidation] connect 실패:', err.message);
            }
        });

        console.log('[PluginInvalidation] 구독자 초기화 완료:', PLUGIN_INVALIDATION_CHANNEL);
    } catch (err) {
        // 초기화 실패해도 앱은 계속 뜬다. 파드 간 무효화 전파만 열화.
        console.error('[PluginInvalidation] 구독자 초기화 실패(무시):', err);
    }
}
