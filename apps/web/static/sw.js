/// <reference lib="webworker" />

/**
 * Angple Service Worker
 *
 * 전략: 모든 요청 Network First (배포 후 stale 캐시 방지)
 * - 네트워크 성공 → 캐시 업데이트 + 응답
 * - 네트워크 실패 → 캐시 폴백 (오프라인 지원)
 * - 푸시 알림 수신/클릭 처리
 */

const CACHE_NAME = 'angple-v7';

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

// 클라이언트에서 SKIP_WAITING 메시지 수신 시 대기 중인 SW 즉시 활성화
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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

    // _app/immutable/ → Network First (배포 후 stale JS 제공 방지)
    // 해시 파일명이라 이론상 Cache First가 안전하지만,
    // 배포 직후 Cloudflare/브라우저 캐시와의 경합 상태에서 흰 화면 유발 가능
    if (url.pathname.startsWith('/_app/immutable/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 기타 정적 자산 → Network First (배포 후 변경 가능)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(networkFirst(request));
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

/** 정적 자산 판별 */
function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff2?|ttf|eot|ico)(\?.*)?$/.test(pathname);
}
