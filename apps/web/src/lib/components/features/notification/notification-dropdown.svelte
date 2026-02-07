<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { Notification, NotificationListResponse } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import Bell from '@lucide/svelte/icons/bell';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Reply from '@lucide/svelte/icons/reply';
    import AtSign from '@lucide/svelte/icons/at-sign';
    import Heart from '@lucide/svelte/icons/heart';
    import Mail from '@lucide/svelte/icons/mail';
    import Info from '@lucide/svelte/icons/info';
    import Check from '@lucide/svelte/icons/check';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    // 상태
    let notifications = $state<Notification[]>([]);
    let unreadCount = $state(0);
    let isLoading = $state(false);
    let isOpen = $state(false);

    // 알림 타입별 아이콘
    function getNotificationIcon(type: Notification['type']) {
        switch (type) {
            case 'comment':
                return MessageSquare;
            case 'reply':
                return Reply;
            case 'mention':
                return AtSign;
            case 'like':
                return Heart;
            case 'message':
                return Mail;
            case 'system':
            default:
                return Info;
        }
    }

    // 알림 타입별 색상
    function getNotificationColor(type: Notification['type']): string {
        switch (type) {
            case 'comment':
                return 'text-blue-500';
            case 'reply':
                return 'text-green-500';
            case 'mention':
                return 'text-purple-500';
            case 'like':
                return 'text-red-500';
            case 'message':
                return 'text-orange-500';
            case 'system':
            default:
                return 'text-muted-foreground';
        }
    }

    // 시간 포맷
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

    // 읽지 않은 알림 수 로드
    async function loadUnreadCount(): Promise<void> {
        if (!authStore.isAuthenticated) return;

        try {
            const summary = await apiClient.getUnreadNotificationCount();
            unreadCount = summary.total_unread;
        } catch (err) {
            console.error('Failed to load unread count:', err);
        }
    }

    // 알림 목록 로드
    async function loadNotifications(): Promise<void> {
        if (!authStore.isAuthenticated) return;

        isLoading = true;
        try {
            const response = await apiClient.getNotifications(1, 10);
            notifications = response.items;
            unreadCount = response.unread_count;
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            isLoading = false;
        }
    }

    // 알림 클릭 처리
    async function handleNotificationClick(notification: Notification): Promise<void> {
        // 읽음 처리
        if (!notification.is_read) {
            try {
                await apiClient.markNotificationAsRead(notification.id);
                notification.is_read = true;
                unreadCount = Math.max(0, unreadCount - 1);
            } catch (err) {
                console.error('Failed to mark as read:', err);
            }
        }

        // URL이 있으면 이동
        if (notification.url) {
            isOpen = false;
            goto(notification.url);
        }
    }

    // 모두 읽음 처리
    async function handleMarkAllAsRead(): Promise<void> {
        try {
            await apiClient.markAllNotificationsAsRead();
            notifications = notifications.map((n) => ({ ...n, is_read: true }));
            unreadCount = 0;
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    }

    // 드롭다운 열릴 때 알림 로드
    function handleOpenChange(open: boolean): void {
        isOpen = open;
        if (open) {
            loadNotifications();
        }
    }

    // 초기 로드
    onMount(() => {
        loadUnreadCount();

        // 30초마다 읽지 않은 알림 수 갱신
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    });
</script>

<DropdownMenu.Root onOpenChange={handleOpenChange}>
    <DropdownMenu.Trigger
        class="hover:bg-muted relative inline-flex items-center justify-center rounded-lg p-2 transition-colors"
    >
        <span class={unreadCount > 0 ? 'bell-ring' : ''}>
            <Bell class="text-muted-foreground h-5 w-5" />
        </span>
        {#if unreadCount > 0}
            <span
                class="bg-primary absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full noti-pulse"
            ></span>
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
                {#each notifications as notification (notification.id)}
                    {@const Icon = getNotificationIcon(notification.type)}
                    <DropdownMenu.Item
                        class="flex cursor-pointer items-start gap-3 p-3 {notification.is_read
                            ? 'opacity-60'
                            : 'bg-muted/30'}"
                        onclick={() => handleNotificationClick(notification)}
                    >
                        <div class="mt-0.5 shrink-0">
                            <Icon class="h-4 w-4 {getNotificationColor(notification.type)}" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-foreground line-clamp-1 text-sm font-medium">
                                {notification.title}
                            </p>
                            <p class="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                {notification.content}
                            </p>
                            <p class="text-muted-foreground mt-1 text-xs">
                                {formatTime(notification.created_at)}
                            </p>
                        </div>
                        {#if !notification.is_read}
                            <div class="shrink-0">
                                <div class="bg-primary h-2 w-2 rounded-full"></div>
                            </div>
                        {/if}
                    </DropdownMenu.Item>
                {/each}
            {/if}
        </div>

        {#if notifications.length > 0}
            <div class="border-t px-3 py-2">
                <Button
                    variant="ghost"
                    size="sm"
                    class="w-full text-sm"
                    onclick={() => {
                        isOpen = false;
                        goto('/notifications');
                    }}
                >
                    모든 알림 보기
                </Button>
            </div>
        {/if}
    </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* 벨 흔들림 애니메이션 (asis 스타일) */
    .bell-ring {
        animation: bell-ring 6s 0.7s infinite;
        transform-origin: 50% 4px;
        display: inline-block;
    }

    @keyframes bell-ring {
        0% { transform: rotate(0); }
        1% { transform: rotate(30deg); }
        3% { transform: rotate(-28deg); }
        5% { transform: rotate(34deg); }
        7% { transform: rotate(-32deg); }
        9% { transform: rotate(30deg); }
        11% { transform: rotate(-28deg); }
        13% { transform: rotate(26deg); }
        15% { transform: rotate(-24deg); }
        17% { transform: rotate(22deg); }
        19% { transform: rotate(-20deg); }
        21% { transform: rotate(18deg); }
        23% { transform: rotate(-16deg); }
        25% { transform: rotate(14deg); }
        27% { transform: rotate(-12deg); }
        29% { transform: rotate(10deg); }
        31% { transform: rotate(-8deg); }
        33% { transform: rotate(6deg); }
        35% { transform: rotate(-4deg); }
        37% { transform: rotate(2deg); }
        39% { transform: rotate(-1deg); }
        41% { transform: rotate(1deg); }
        43% { transform: rotate(0); }
        100% { transform: rotate(0); }
    }

    /* 알림 인디케이터 펄스 */
    .noti-pulse {
        animation: noti-pulse 1.25s ease-in-out infinite;
    }

    @keyframes noti-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.3); }
    }
</style>
