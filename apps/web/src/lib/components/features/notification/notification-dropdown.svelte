<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { GroupedNotification } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { normalizeWebUrl, toRelativeIfSameOrigin } from '$lib/utils/url-normalizer';
    import Bell from '@lucide/svelte/icons/bell';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Reply from '@lucide/svelte/icons/reply';
    import AtSign from '@lucide/svelte/icons/at-sign';
    import Heart from '@lucide/svelte/icons/heart';
    import Star from '@lucide/svelte/icons/star';
    import Mail from '@lucide/svelte/icons/mail';
    import Info from '@lucide/svelte/icons/info';
    import Check from '@lucide/svelte/icons/check';
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
    let isOpen = $state(false);

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

    function getNotificationIcon(type: string) {
        switch (type) {
            case 'comment':
                return MessageSquare;
            case 'reply':
                return Reply;
            case 'mention':
                return AtSign;
            case 'like':
                return Heart;
            case 'memo':
                return Mail;
            case 'levelup':
                return Star;
            default:
                return Info;
        }
    }

    function getNotificationColor(type: string): string {
        switch (type) {
            case 'comment':
                return 'text-blue-500';
            case 'reply':
                return 'text-green-500';
            case 'mention':
                return 'text-purple-500';
            case 'like':
                return 'text-red-500';
            case 'memo':
                return 'text-orange-500';
            case 'levelup':
                return 'text-yellow-500';
            default:
                return 'text-muted-foreground';
        }
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

    async function loadNotifications(): Promise<void> {
        if (!authStore.isAuthenticated) return;

        isLoading = true;
        try {
            const response = await apiClient.getGroupedNotifications(1, 10);
            notifications = response.items;
            unreadCount = response.unread_count;
            writeUnreadCache(response.unread_count);
        } catch (err) {
            console.error('Failed to load notifications:', err);
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
                    notification.from_case
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
            if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                window.location.href = targetUrl;
                return;
            }
            await goto(targetUrl);
            // 해시가 있으면 수동 스크롤 (SvelteKit goto는 같은 페이지 해시 이동을 처리하지 않음)
            const hash = targetUrl.split('#')[1];
            if (hash) {
                requestAnimationFrame(() => {
                    document
                        .getElementById(hash)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
            }
        }
    }

    async function handleMarkAllAsRead(): Promise<void> {
        try {
            await apiClient.markAllNotificationsAsRead();
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

    function handleOpenChange(open: boolean): void {
        if (open) {
            void loadNotifications();
        }
    }

    onMount(() => {
        const scheduleUnreadLoad = () => {
            const task = () => {
                if (document.visibilityState !== 'visible') return;
                void loadUnreadCount();
            };

            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(task, { timeout: 2000 });
                return;
            }

            globalThis.setTimeout(task, 250);
        };

        scheduleUnreadLoad();

        let interval: ReturnType<typeof setInterval> | null = null;

        function startPolling() {
            if (interval) return;
            interval = setInterval(loadUnreadCount, 600000);
        }

        function stopPolling() {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                scheduleUnreadLoad();
                startPolling();
            } else {
                stopPolling();
            }
        }

        if (document.visibilityState === 'visible') {
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
        <div class="flex items-center justify-between border-b px-3 py-2">
            <span class="text-foreground font-semibold">알림</span>
            {#if unreadCount > 0}
                <Button variant="ghost" size="sm" class="h-7 text-xs" onclick={handleMarkAllAsRead}>
                    <Check class="mr-1 h-3 w-3" />
                    모두 읽음
                </Button>
            {/if}
        </div>

        <div class="max-h-80 overflow-y-auto">
            {#if isLoading}
                <div class="flex items-center justify-center py-8">
                    <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
            {:else if notifications.length === 0}
                <div class="text-muted-foreground py-8 text-center text-sm">알림이 없습니다</div>
            {:else}
                {#each notifications as notification (notification.bo_table + ':' + notification.wr_id + ':' + notification.from_case)}
                    {@const Icon = getNotificationIcon(notification.type)}
                    <DropdownMenu.Item
                        class="flex cursor-pointer items-start gap-2.5 px-3 py-2 {notification.has_unread
                            ? 'bg-muted/30'
                            : 'opacity-60'}"
                        onSelect={(e) => {
                            // Dropdown 기본 select 동작(즉시 닫힘/포커스 이동)과 라우팅 충돌을 방지
                            e.preventDefault();
                            void handleNotificationClick(notification);
                        }}
                    >
                        <div class="mt-0.5 shrink-0">
                            <Icon class="h-4 w-4 {getNotificationColor(notification.type)}" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-foreground line-clamp-1 text-[13px] font-medium">
                                {notification.title}
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
