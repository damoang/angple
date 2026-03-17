/// <reference lib="webworker" />

/**
 * Angple Service Worker
 *
 * 전략: 모든 요청 Network First (배포 후 stale 캐시 방지)
 * - 네트워크 성공 → 캐시 업데이트 + 응답
 * - 네트워크 실패 → 캐시 폴백 (오프라인 지원)
 * - 푸시 알림 수신/클릭 처리
 */

const CACHE_NAME = 'angple-v8';

// 앱 셸 프리캐시 목록 (빈 배열 — 오프라인 페이지 없으므로 프리캐시 불필요)
const PRECACHE_URLS = [];

// 설치: 오프라인 페이지 프리캐시
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// 활성화: 모든 이전 캐시 정리 + 즉시 제어권 획득
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// 요청 가로채기
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // dev 환경: 캐싱 완전 비활성화 (모든 요청을 네트워크로 통과)
    if (self.location.hostname === 'localhost' || self.location.hostname.startsWith('dev.')) {
        return;
    }

    // 같은 출처의 요청만 처리
    if (url.origin !== self.location.origin) return;

    // API 요청: Network First (GET만 캐시, POST 등은 패스스루)
    if (url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET') return;
        event.respondWith(networkFirst(request));
        return;
    }

    // _app/immutable/ → SW 개입 안 함 (네트워크 직접 요청)
    // 해시 파일명이라 브라우저/CDN 캐시만으로 충분.
    // SW가 캐싱하면 배포 후 stale 청크 서빙 → 무한 새로고침 유발.
    if (url.pathname.startsWith('/_app/immutable/')) {
        return;
    }

    // 기타 정적 자산 → Network First (배포 후 변경 가능)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // __data.json Circuit Breaker: 연속 실패 시 서버 요청 폭풍 차단
    if (url.pathname.endsWith('/__data.json')) {
        event.respondWith(dataJsonWithCircuitBreaker(request));
        return;
    }

    // HTML 내비게이션: Network Only (오프라인 폴백 없음)
    if (request.mode === 'navigate') {
        return;
    }
});

/** Network First 전략 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return (
            cached ||
            new Response(JSON.stringify({ error: 'Offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    }
}

// 푸시 알림 수신
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.content || data.body || '',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: data.tag || 'angple-notification',
            data: { url: data.url || '/' }
        };

        event.waitUntil(self.registration.showNotification(data.title || 'Angple', options));
    } catch {
        // 푸시 데이터 파싱 실패 무시
    }
});

// 알림 클릭 시 해당 URL로 이동
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // 이미 열린 탭이 있으면 포커스
            for (const client of clients) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            // 없으면 새 탭 열기
            return self.clients.openWindow(url);
        })
    );
});

/** __data.json Circuit Breaker */
let dataJsonFailCount = 0;
let dataJsonCooldownUntil = 0;
const DATA_JSON_MAX_FAILS = 3;
const DATA_JSON_COOLDOWN_MS = 10000;

async function dataJsonWithCircuitBreaker(request) {
    const now = Date.now();
    // 쿨다운 중이면 즉시 503 반환
    if (dataJsonFailCount >= DATA_JSON_MAX_FAILS && now < dataJsonCooldownUntil) {
        return new Response(JSON.stringify({ error: 'Circuit breaker open — too many failures' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    // 쿨다운 만료 시 리셋
    if (now >= dataJsonCooldownUntil && dataJsonFailCount >= DATA_JSON_MAX_FAILS) {
        dataJsonFailCount = 0;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            dataJsonFailCount = 0; // 성공 시 즉시 리셋
        } else {
            dataJsonFailCount++;
            if (dataJsonFailCount >= DATA_JSON_MAX_FAILS) {
                dataJsonCooldownUntil = Date.now() + DATA_JSON_COOLDOWN_MS;
            }
        }
        return response;
    } catch {
        dataJsonFailCount++;
        if (dataJsonFailCount >= DATA_JSON_MAX_FAILS) {
            dataJsonCooldownUntil = Date.now() + DATA_JSON_COOLDOWN_MS;
        }
        return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/** 정적 자산 판별 */
function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff2?|ttf|eot|ico)(\?.*)?$/.test(pathname);
}
