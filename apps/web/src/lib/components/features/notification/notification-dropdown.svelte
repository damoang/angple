<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { GroupedNotification } from '$lib/api/types.js';
    import { onMount, tick } from 'svelte';
    import { goto } from '$app/navigation';
    import { isNotiMergeEnabled } from '$lib/utils/noti-merge-pref.js';
    import { browser } from '$app/environment';
    import { normalizeWebUrl, toRelativeIfSameOrigin } from '$lib/utils/url-normalizer';
    import Bell from '@lucide/svelte/icons/bell';
    import Check from '@lucide/svelte/icons/check';
    // 알림 종류 표시는 두 화면(드롭다운·알림함)이 같은 모듈을 쓴다 — bug/13242
    import { getNotificationIcon } from '$lib/utils/notification-icon.js';
    import {
        getNotificationColor,
        getNotificationEmoji,
        getNotificationLabel
    } from '$lib/utils/notification-type.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Settings from '@lucide/svelte/icons/settings';

    const UNREAD_CACHE_TTL_MS = 30_000;
    const UNREAD_CACHE_STORAGE_KEY = 'angple_notification_unread_cache_v1';

    let unreadCache = {
        count: 0,
        fetchedAt: 0
    };
    let unreadInflight: Promise<number> | null = null;

    let notifications = $state<GroupedNotification[]>([]);
    let unreadCount = $state(0);
    let isLoading = $state(false);
    let loadError = $state(false);
    let isOpen = $state(false);
    let unreadPrimed = $state(false);

    function readUnreadCache(): { count: number; fetchedAt: number } | null {
        if (typeof window === 'undefined') return null;

        try {
            const raw = window.sessionStorage.getItem(UNREAD_CACHE_STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw) as { count?: unknown; fetchedAt?: unknown };
            const count = typeof parsed.count === 'number' ? parsed.count : null;
            const fetchedAt = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : null;

            if (count === null || fetchedAt === null) return null;
            return { count, fetchedAt };
        } catch {
            return null;
        }
    }

    function writeUnreadCache(count: number): void {
        unreadCache = { count, fetchedAt: Date.now() };

        if (typeof window === 'undefined') return;

        try {
            window.sessionStorage.setItem(UNREAD_CACHE_STORAGE_KEY, JSON.stringify(unreadCache));
        } catch {
            // ignore storage quota / private mode failures
        }
    }

    function normalizeNotificationUrl(rawUrl: string, type: string): string {
        let url = rawUrl.replaceAll('&amp;', '&').trim();
        if (type === 'like' && !url.includes('#')) {
            url += '#likes';
        }

        if (!browser) return url;

        const normalized = normalizeWebUrl(url, { baseOrigin: window.location.origin });
        return toRelativeIfSameOrigin(normalized, window.location.origin);
    }

    function formatTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}시간 전`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}일 전`;

        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
        });
    }

    async function loadUnreadCount(): Promise<void> {
        if (!authStore.isAuthenticated) return;

        try {
            const now = Date.now();
            const storedCache = readUnreadCache();
            if (storedCache && now - storedCache.fetchedAt < UNREAD_CACHE_TTL_MS) {
                unreadCache = storedCache;
                unreadCount = storedCache.count;
                return;
            }

            if (now - unreadCache.fetchedAt < UNREAD_CACHE_TTL_MS) {
                unreadCount = unreadCache.count;
                return;
            }

            if (!unreadInflight) {
                unreadInflight = apiClient
                    .getUnreadNotificationCount()
                    .then((summary) => {
                        const count = summary?.total_unread ?? 0;
                        writeUnreadCache(count);
                        return count;
                    })
                    .finally(() => {
                        unreadInflight = null;
                    });
            }

            unreadCount = await unreadInflight;
        } catch {
            // 401(토큰 만료/도메인 불일치) 등은 조용히 무시
        }
    }

    function primeUnreadCount(): void {
        if (!authStore.isAuthenticated || unreadPrimed) return;
        unreadPrimed = true;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
        }
        void loadUnreadCount();
    }

    // 성공 여부를 반환한다 — markSeenOnOpen 게이트용. loadError 플래그는 #12954 의도로
    // "기존 목록이 남아 있으면 실패해도 false" 라 실패 판정에 못 쓴다(오래된 목록을
    // 보여주며 못 본 알림을 읽음 처리하는 구멍이 생긴다).
    async function loadNotifications(): Promise<boolean> {
        if (!authStore.isAuthenticated) return false;

        isLoading = true;
        loadError = false;
        try {
            const response = await apiClient.getGroupedNotifications(
                1,
                10,
                '',
                isNotiMergeEnabled()
            );
            notifications = response.items;
            unreadCount = response.unread_count;
            writeUnreadCache(response.unread_count);
            return true;
        } catch (err) {
            console.error('Failed to load notifications:', err);
            // 실패를 '알림이 없습니다' 로 오표시하지 않도록 에러 상태 노출(#12954).
            if (notifications.length === 0) loadError = true;
            return false;
        } finally {
            isLoading = false;
        }
    }

    async function handleNotificationClick(notification: GroupedNotification): Promise<void> {
        if (notification.has_unread) {
            try {
                await apiClient.markGroupAsRead(
                    notification.bo_table,
                    notification.wr_id,
                    notification.from_case,
                    notification.target_key
                );
                notification.has_unread = false;
                unreadCount = Math.max(0, unreadCount - notification.unread_count);
                writeUnreadCache(unreadCount);
                notification.unread_count = 0;
            } catch (err) {
                console.error('Failed to mark as read:', err);
            }
        }

        if (notification.url) {
            const targetUrl = normalizeNotificationUrl(notification.url, notification.type);
            isOpen = false;
            await tick(); // 드롭다운이 닫힌 후 네비게이션
            if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                window.location.href = targetUrl;
                return;
            }
            await goto(targetUrl);
            // 해시가 있으면 재시도 스크롤 (댓글 스트리밍으로 DOM이 늦게 생성될 수 있음)
            const hash = targetUrl.split('#')[1];
            if (hash) {
                let attempts = 0;
                const tryScroll = () => {
                    const el = document.getElementById(hash);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else if (attempts < 30) {
                        attempts++;
                        requestAnimationFrame(tryScroll);
                    }
                };
                requestAnimationFrame(tryScroll);
            }
        }
    }

    // 버튼을 눌러도 화면이 그대로라 "체크가 안 풀린다"고 읽혔다(bug/13206).
    // 눌린 사실이 보이도록 짧게 문구를 바꾼다.
    let markedJustNow = $state(false);

    async function handleMarkAllAsRead(): Promise<void> {
        try {
            await apiClient.markAllNotificationsAsRead();
            markedJustNow = true;
            setTimeout(() => (markedJustNow = false), 1600);
            notifications = notifications.map((n) => ({
                ...n,
                has_unread: false,
                unread_count: 0
            }));
            unreadCount = 0;
            writeUnreadCache(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    }

    // #12991 → seen/read 분리(bug/13367·13332·13206 체인의 종결):
    // 종을 열면 "봤다(seen)"만 서버에 기록해 뱃지를 지운다 — 12991 의 원요구.
    // 항목별 읽음(굵은 표시)은 각 알림을 클릭할 때만 지워진다. 예전처럼 read-all 을
    // 쏘면 열기만 해도 8만 건이 비가역으로 읽음 처리되는 문제(13367)가 있었다.
    // 자동읽음 설정 게이트는 제거 — seen 은 파괴적이지 않아 옵션일 이유가 없다.
    // ⛔ 이번 로드가 성공했을 때만 처리한다 — 보지도 못한 알림의 뱃지를 지우면 안 된다.
    async function markSeenOnOpen(): Promise<void> {
        if (unreadCount <= 0) return;
        try {
            await apiClient.markNotificationsSeen();
            unreadCount = 0;
            writeUnreadCache(0);
        } catch (err) {
            console.error('Failed to mark notifications seen:', err);
        }
    }

    // 열림·재시도 공용: 로드가 성공한 경우에만 배지를 해소한다.
    async function loadAndMarkSeen(): Promise<void> {
        const ok = await loadNotifications();
        if (ok) await markSeenOnOpen();
    }

    function handleOpenChange(open: boolean): void {
        if (open) {
            void loadAndMarkSeen();
        }
    }

    onMount(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        function startPolling() {
            if (interval || !unreadPrimed) return;
            interval = setInterval(loadUnreadCount, 180_000);
        }

        // 페이지 로드 시 자동 prime (hover 없이도 알림 수 표시)
        // auth 초기화(layout onMount)가 완료된 후 호출해야 하므로 200ms 대기.
        // ⛔ prime 직후 여기서 폴링을 시작해야 한다 — 아래의 동기 startPolling() 게이트는
        //    이 시점(unreadPrimed=false)에 항상 헛발이라, 탭을 계속 보고 있는 사용자는
        //    폴링이 영영 시작되지 않았다(12954→13033→13089 "숫자가 안 바뀜" 체인의 원인).
        if (!unreadPrimed && document.visibilityState === 'visible') {
            setTimeout(() => {
                primeUnreadCount();
                startPolling();
            }, 200);
        }

        function stopPolling() {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        }

        let visibilityDebounce: ReturnType<typeof setTimeout> | null = null;

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                if (visibilityDebounce) clearTimeout(visibilityDebounce);
                visibilityDebounce = setTimeout(() => {
                    if (unreadPrimed) {
                        void loadUnreadCount();
                    }
                    startPolling();
                }, 5000);
            } else {
                if (visibilityDebounce) {
                    clearTimeout(visibilityDebounce);
                    visibilityDebounce = null;
                }
                stopPolling();
            }
        }

        if (document.visibilityState === 'visible' && unreadPrimed) {
            startPolling();
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    });
</script>

<DropdownMenu.Root bind:open={isOpen} onOpenChange={handleOpenChange}>
    <DropdownMenu.Trigger
        class="hover:bg-muted relative inline-flex items-center justify-center rounded-lg p-2 transition-colors"
        onmouseenter={primeUnreadCount}
        onfocus={primeUnreadCount}
    >
        <span class={unreadCount > 0 ? 'bell-ring' : ''}>
            <Bell class="text-muted-foreground h-5 w-5" />
        </span>
        {#if unreadCount > 0}
            <span
                class="bg-primary noti-pulse absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
                >{unreadCount > 99 ? '99+' : unreadCount}</span
            >
        {/if}
        <span class="sr-only">알림</span>
    </DropdownMenu.Trigger>

    <DropdownMenu.Content class="w-80" align="end">
        <!--
            「모두 읽음」 버튼은 푸터로 옮겼다(free/6875994 회원 의견). 여기 있던 조건부
            버튼은 열자마자 auto-read 로 unreadCount 가 0 이 되어 사실상 보이지 않았다.
        -->
        <div class="flex items-center justify-between border-b px-3 py-2">
            <span class="text-foreground font-semibold">알림</span>
        </div>

        <div class="max-h-80 overflow-y-auto">
            {#if isLoading && notifications.length === 0}
                <!-- 캐시된 알림이 있으면 스피너로 가리지 않고 즉시 노출 → 재오픈 시 백그라운드 갱신(체감 지연 제거) -->
                <div class="flex items-center justify-center py-8">
                    <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
            {:else if loadError}
                <div class="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
                    <span>알림을 불러오지 못했습니다.</span>
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-7 text-xs"
                        onclick={loadAndMarkSeen}
                    >
                        다시 시도
                    </Button>
                </div>
            {:else if notifications.length === 0}
                <div class="text-muted-foreground py-8 text-center text-sm">알림이 없습니다</div>
            {:else}
                {#each notifications as notification (notification.bo_table + ':' + notification.wr_id + ':' + notification.from_case + ':' + (notification.target_key ?? ''))}
                    {@const Icon = getNotificationIcon(notification.type)}
                    <DropdownMenu.Item
                        class="flex cursor-pointer items-start gap-2.5 px-3 py-2 {notification.has_unread
                            ? 'bg-muted/30'
                            : 'opacity-60'}"
                        onclick={() => {
                            isOpen = false;
                            void handleNotificationClick(notification);
                        }}
                    >
                        <div class="mt-0.5 shrink-0">
                            <Icon class="h-4 w-4 {getNotificationColor(notification.type)}" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <!-- ⛔ 종류 표식은 반드시 제목 '앞'에 온다. line-clamp-1 은 뒤에서
                                 자르므로, 뒤에 두면 닉네임이 길 때 종류가 먼저 사라진다
                                 (bug/13242 제보 그대로의 증상). -->
                            <p class="text-foreground line-clamp-1 text-[13px] font-medium">
                                {#if getNotificationEmoji(notification.type)}
                                    <span
                                        class="mr-0.5"
                                        title={getNotificationLabel(notification.type)}
                                        aria-hidden="true"
                                        >{getNotificationEmoji(notification.type)}</span
                                    >
                                    <span class="sr-only"
                                        >{getNotificationLabel(notification.type)}</span
                                    >
                                {/if}{notification.title}
                            </p>
                            {#if notification.parent_subject}
                                <p class="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                                    {notification.parent_subject}
                                </p>
                            {/if}
                            <p class="text-muted-foreground mt-0.5 text-[10px]">
                                {formatTime(notification.latest_at)}
                            </p>
                        </div>
                        {#if notification.has_unread}
                            <div class="mt-1 shrink-0">
                                <div class="bg-primary h-1.5 w-1.5 rounded-full"></div>
                            </div>
                        {/if}
                    </DropdownMenu.Item>
                {/each}
            {/if}
        </div>

        {#if notifications.length > 0}
            <div class="flex gap-1 border-t px-3 py-2">
                <a
                    href="/notifications"
                    class="hover:bg-accent flex-1 rounded-md py-1.5 text-center text-sm transition-colors"
                    onclick={(e: MouseEvent) => {
                        e.preventDefault();
                        isOpen = false;
                        goto('/notifications');
                    }}
                >
                    모든 알림 보기
                </a>
                <!--
                    명시적 「모두 읽기」 — 종을 열면 배지(숫자)는 풀리지만 새 알림 강조는
                    남는다(#12991 설계). 강조까지 한 번에 걷어내는 손잡이가 이 버튼이다.
                    항상 노출한다 - 지울 게 없을 때 눌러도 무해(멱등)하고, 조건부로 숨기면
                    "버튼이 없어졌다"는 혼란(free/6875994)이 재발한다.
                -->
                <button
                    type="button"
                    class="hover:bg-accent flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-center text-sm transition-colors"
                    onclick={handleMarkAllAsRead}
                >
                    <Check class="h-3.5 w-3.5" />
                    {markedJustNow ? '읽음 처리했습니다' : '모두 읽기'}
                </button>
                <a
                    href="/member/settings/ui?tab=notification"
                    class="hover:bg-accent flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-center text-sm transition-colors"
                    onclick={(e: MouseEvent) => {
                        e.preventDefault();
                        isOpen = false;
                        goto('/member/settings/ui?tab=notification');
                    }}
                >
                    <Settings class="h-3.5 w-3.5" />
                    알림설정
                </a>
            </div>
        {/if}
    </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        line-clamp: 1;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* 벨 흔들림 애니메이션 */
    .bell-ring {
        animation: bell-ring 6s 0.7s infinite;
        transform-origin: 50% 4px;
        display: inline-block;
    }

    @keyframes bell-ring {
        0% {
            transform: rotate(0);
        }
        1% {
            transform: rotate(30deg);
        }
        3% {
            transform: rotate(-28deg);
        }
        5% {
            transform: rotate(34deg);
        }
        7% {
            transform: rotate(-32deg);
        }
        9% {
            transform: rotate(30deg);
        }
        11% {
            transform: rotate(-28deg);
        }
        13% {
            transform: rotate(26deg);
        }
        15% {
            transform: rotate(-24deg);
        }
        17% {
            transform: rotate(22deg);
        }
        19% {
            transform: rotate(-20deg);
        }
        21% {
            transform: rotate(18deg);
        }
        23% {
            transform: rotate(-16deg);
        }
        25% {
            transform: rotate(14deg);
        }
        27% {
            transform: rotate(-12deg);
        }
        29% {
            transform: rotate(10deg);
        }
        31% {
            transform: rotate(-8deg);
        }
        33% {
            transform: rotate(6deg);
        }
        35% {
            transform: rotate(-4deg);
        }
        37% {
            transform: rotate(2deg);
        }
        39% {
            transform: rotate(-1deg);
        }
        41% {
            transform: rotate(1deg);
        }
        43% {
            transform: rotate(0);
        }
        100% {
            transform: rotate(0);
        }
    }

    /* 알림 인디케이터 펄스 */
    .noti-pulse {
        animation: noti-pulse 1.25s ease-in-out infinite;
    }

    @keyframes noti-pulse {
        0%,
        100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.6;
            transform: scale(1.3);
        }
    }
</style>
