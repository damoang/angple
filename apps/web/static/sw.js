/// <reference lib="webworker" />

/**
 * Angple Service Worker
 *
 * 전략:
 * - 앱 셸(HTML/CSS/JS): Cache First → 빠른 로드
 * - API 요청: Network First → 최신 데이터 우선
 * - 이미지/폰트: Cache First → 대역폭 절약
 * - 오프라인 시: 캐시된 오프라인 페이지 표시
 */

const CACHE_NAME = 'angple-v2';
const OFFLINE_URL = '/offline.html';

// 앱 셸 프리캐시 목록
const PRECACHE_URLS = [OFFLINE_URL];

// 설치: 오프라인 페이지 프리캐시
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// 활성화: 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                )
            )
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

    // 정적 자산 (이미지, 폰트, JS, CSS): Cache First
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // HTML 내비게이션: Network First + 오프라인 폴백
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 }))
            )
        );
        return;
    }
});

/** Cache First 전략 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('', { status: 503 });
    }
}

/** Network First 전략 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
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

/** 정적 자산 판별 */
function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff2?|ttf|eot|ico)(\?.*)?$/.test(pathname);
}
