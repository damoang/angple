<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { GroupedNotificationListResponse, GroupedNotification } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import Bell from '@lucide/svelte/icons/bell';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Reply from '@lucide/svelte/icons/reply';
    import AtSign from '@lucide/svelte/icons/at-sign';
    import Heart from '@lucide/svelte/icons/heart';
    import Star from '@lucide/svelte/icons/star';
    import Info from '@lucide/svelte/icons/info';
    import Check from '@lucide/svelte/icons/check';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import Settings from '@lucide/svelte/icons/settings';

    let { data }: { data: PageData } = $props();

    let notificationData = $state<GroupedNotificationListResponse | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);
    let activeFilter = $state('');

    const filters = [
        { key: '', label: '전체' },
        { key: 'comment', label: '댓글' },
        { key: 'like', label: '추천' },
        { key: 'mention', label: '멘션' },
        { key: 'system', label: '시스템' }
    ];

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

    async function loadNotifications(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        isLoading = true;
        error = null;

        try {
            notificationData = await apiClient.getGroupedNotifications(
                data.page,
                data.limit,
                activeFilter
            );
        } catch (err) {
            error = err instanceof Error ? err.message : '알림을 불러오는데 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    function goToPage(pageNum: number): void {
        goto(`/notifications?page=${pageNum}`);
    }

    function setFilter(key: string): void {
        activeFilter = key;
        loadNotifications();
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
                notification.unread_count = 0;
                if (notificationData) {
                    notificationData.unread_count = Math.max(
                        0,
                        notificationData.unread_count - notification.unread_count
                    );
                }
            } catch (err) {
                console.error('Failed to mark as read:', err);
            }
        }

        if (notification.url) {
            let url = notification.url;
            if (notification.type === 'like' && !url.includes('#')) {
                url += '#likes';
            }
            goto(url);
        }
    }

    async function handleMarkAllAsRead(): Promise<void> {
        try {
            await apiClient.markAllNotificationsAsRead();
            if (notificationData) {
                notificationData.items = notificationData.items.map((n) => ({
                    ...n,
                    has_unread: false,
                    unread_count: 0
                }));
                notificationData.unread_count = 0;
            }
        } catch (err) {
            console.error('Failed to mark all as read:', err);
            alert('알림 읽음 처리에 실패했습니다.');
        }
    }

    async function handleDeleteGroup(
        notification: GroupedNotification,
        event: Event
    ): Promise<void> {
        event.stopPropagation();
        if (!confirm('이 알림 그룹을 삭제하시겠습니까?')) return;

        try {
            await apiClient.deleteNotificationGroup(
                notification.bo_table,
                notification.wr_id,
                notification.from_case
            );
            if (notificationData) {
                notificationData.items = notificationData.items.filter(
                    (n) =>
                        !(
                            n.bo_table === notification.bo_table &&
                            n.wr_id === notification.wr_id &&
                            n.from_case === notification.from_case
                        )
                );
                notificationData.total--;
            }
        } catch (err) {
            console.error('Failed to delete group:', err);
            alert('알림 삭제에 실패했습니다.');
        }
    }

    onMount(() => {
        loadNotifications();
    });

    $effect(() => {
        if (data.page) {
            loadNotifications();
        }
    });
</script>

<svelte:head>
    <title>알림 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 pt-4">
    <!-- 헤더 -->
    <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <button
                onclick={() => goto('/my')}
                class="text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft class="h-5 w-5" />
            </button>
            <h1 class="text-foreground flex items-center gap-2 text-lg font-semibold">
                <Bell class="h-5 w-5" />
                알림
                {#if notificationData && notificationData.unread_count > 0}
                    <span
                        class="bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    >
                        {notificationData.unread_count}
                    </span>
                {/if}
            </h1>
        </div>
        {#if notificationData && notificationData.unread_count > 0}
            <Button variant="ghost" size="sm" class="text-xs" onclick={handleMarkAllAsRead}>
                <Check class="mr-1 h-3.5 w-3.5" />
                모두 읽음
            </Button>
        {/if}
    </div>

    <!-- 필터 탭 -->
    <div class="border-border mb-3 flex items-center gap-1 border-b pb-2">
        {#each filters as filter}
            <button
                onclick={() => setFilter(filter.key)}
                class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {activeFilter ===
                filter.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            >
                {filter.label}
            </button>
        {/each}
        <button
            onclick={() => goto('/member/settings/ui?tab=notification')}
            class="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        >
            <Settings class="h-3.5 w-3.5" />
            설정
        </button>
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-16">
            <Loader2 class="text-primary h-6 w-6 animate-spin" />
        </div>
    {:else if error}
        <div class="text-destructive py-8 text-center text-sm">{error}</div>
    {:else if notificationData}
        {#if notificationData.items.length > 0}
            <div class="divide-border divide-y">
                {#each notificationData.items as notification}
                    {@const Icon = getNotificationIcon(notification.type)}
                    <div
                        role="button"
                        tabindex="0"
                        onclick={() => handleNotificationClick(notification)}
                        onkeydown={(e) => {
                            if (e.key === 'Enter') handleNotificationClick(notification);
                        }}
                        class="hover:bg-accent/50 group flex w-full cursor-pointer items-center gap-3 px-1 py-2.5 text-left transition-colors {notification.has_unread
                            ? 'bg-muted/30'
                            : ''}"
                    >
                        <!-- 아이콘 -->
                        <div
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {notification.has_unread
                                ? 'bg-primary/10'
                                : 'bg-muted'}"
                        >
                            <Icon class="h-4 w-4 {getNotificationColor(notification.type)}" />
                        </div>

                        <!-- 내용 -->
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                                <span
                                    class="truncate text-sm {notification.has_unread
                                        ? 'text-foreground font-semibold'
                                        : 'text-foreground/80'}"
                                >
                                    {notification.title}
                                </span>
                                {#if notification.has_unread}
                                    <span class="bg-primary h-1.5 w-1.5 shrink-0 rounded-full"
                                    ></span>
                                {/if}
                            </div>
                            {#if notification.parent_subject}
                                <p class="text-muted-foreground mt-0.5 truncate text-xs">
                                    {notification.parent_subject}
                                </p>
                            {/if}
                        </div>

                        <!-- 시간 + 삭제 -->
                        <div class="flex shrink-0 items-center gap-1">
                            <span class="text-muted-foreground text-[11px]">
                                {formatTime(notification.latest_at)}
                            </span>
                            <button
                                type="button"
                                onclick={(e: Event) => handleDeleteGroup(notification, e)}
                                class="text-muted-foreground hover:text-destructive ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                                <Trash2 class="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <p class="text-muted-foreground py-16 text-center text-sm">알림이 없습니다.</p>
        {/if}

        <!-- 페이지네이션 -->
        {#if notificationData.total_pages > 1}
            <div class="mt-4 flex items-center justify-center gap-2 pb-4">
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                >
                    <ChevronLeft class="h-4 w-4" />
                </Button>

                <span class="text-muted-foreground text-xs">
                    {data.page} / {notificationData.total_pages}
                </span>

                <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    disabled={data.page === notificationData.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    <ChevronRight class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    {/if}
</div>
