<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { Notification, NotificationListResponse } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import Bell from '@lucide/svelte/icons/bell';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Reply from '@lucide/svelte/icons/reply';
    import AtSign from '@lucide/svelte/icons/at-sign';
    import Heart from '@lucide/svelte/icons/heart';
    import Mail from '@lucide/svelte/icons/mail';
    import Info from '@lucide/svelte/icons/info';
    import Check from '@lucide/svelte/icons/check';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';

    let { data }: { data: PageData } = $props();

    // 상태
    let notificationData = $state<NotificationListResponse | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

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

    // 알림 타입 한글
    function getNotificationTypeLabel(type: Notification['type']): string {
        switch (type) {
            case 'comment':
                return '댓글';
            case 'reply':
                return '답글';
            case 'mention':
                return '멘션';
            case 'like':
                return '추천';
            case 'message':
                return '쪽지';
            case 'system':
            default:
                return '시스템';
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
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 알림 목록 로드
    async function loadNotifications(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        isLoading = true;
        error = null;

        try {
            notificationData = await apiClient.getNotifications(data.page, data.limit);
        } catch (err) {
            error = err instanceof Error ? err.message : '알림을 불러오는데 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(`/notifications?page=${pageNum}`);
    }

    // 알림 클릭 처리
    async function handleNotificationClick(notification: Notification): Promise<void> {
        // 읽음 처리
        if (!notification.is_read) {
            try {
                await apiClient.markNotificationAsRead(notification.id);
                notification.is_read = true;
                if (notificationData) {
                    notificationData.unread_count = Math.max(0, notificationData.unread_count - 1);
                }
            } catch (err) {
                console.error('Failed to mark as read:', err);
            }
        }

        // URL이 있으면 이동
        if (notification.url) {
            goto(notification.url);
        }
    }

    // 모두 읽음 처리
    async function handleMarkAllAsRead(): Promise<void> {
        try {
            await apiClient.markAllNotificationsAsRead();
            if (notificationData) {
                notificationData.items = notificationData.items.map((n) => ({
                    ...n,
                    is_read: true
                }));
                notificationData.unread_count = 0;
            }
        } catch (err) {
            console.error('Failed to mark all as read:', err);
            alert('알림 읽음 처리에 실패했습니다.');
        }
    }

    // 알림 삭제
    async function handleDeleteNotification(notificationId: number, event: Event): Promise<void> {
        event.stopPropagation();

        if (!confirm('이 알림을 삭제하시겠습니까?')) return;

        try {
            await apiClient.deleteNotification(notificationId);
            if (notificationData) {
                const deletedNotification = notificationData.items.find(
                    (n) => n.id === notificationId
                );
                notificationData.items = notificationData.items.filter(
                    (n) => n.id !== notificationId
                );
                notificationData.total--;
                if (deletedNotification && !deletedNotification.is_read) {
                    notificationData.unread_count = Math.max(0, notificationData.unread_count - 1);
                }
            }
        } catch (err) {
            console.error('Failed to delete notification:', err);
            alert('알림 삭제에 실패했습니다.');
        }
    }

    // 초기 로드
    onMount(() => {
        loadNotifications();
    });

    // 페이지 변경 시 다시 로드
    $effect(() => {
        if (data.page) {
            loadNotifications();
        }
    });
</script>

<svelte:head>
    <title>알림 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="sm" onclick={() => goto('/my')}>
                <ArrowLeft class="mr-1 h-4 w-4" />
                마이페이지
            </Button>
            <h1 class="text-foreground flex items-center gap-2 text-2xl font-bold">
                <Bell class="h-6 w-6" />
                알림
            </h1>
        </div>
        {#if notificationData && notificationData.unread_count > 0}
            <Button variant="outline" size="sm" onclick={handleMarkAllAsRead}>
                <Check class="mr-2 h-4 w-4" />
                모두 읽음
            </Button>
        {/if}
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-20">
            <Loader2 class="text-primary h-8 w-8 animate-spin" />
        </div>
    {:else if error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{error}</p>
            </CardContent>
        </Card>
    {:else if notificationData}
        <Card class="bg-background">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    전체 알림
                    <span class="text-muted-foreground text-sm font-normal">
                        ({notificationData.total}개)
                    </span>
                    {#if notificationData.unread_count > 0}
                        <span
                            class="bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-medium"
                        >
                            {notificationData.unread_count}개 읽지 않음
                        </span>
                    {/if}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if notificationData.items.length > 0}
                    <ul class="divide-border divide-y">
                        {#each notificationData.items as notification (notification.id)}
                            {@const Icon = getNotificationIcon(notification.type)}
                            <li class="py-3 first:pt-0 last:pb-0">
                                <button
                                    type="button"
                                    onclick={() => handleNotificationClick(notification)}
                                    class="hover:bg-accent -m-1 w-full rounded-md p-3 text-left transition-colors {!notification.is_read
                                        ? 'bg-muted/50'
                                        : ''}"
                                >
                                    <div class="flex items-start gap-3">
                                        <!-- 아이콘 -->
                                        <div
                                            class="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                        >
                                            <Icon
                                                class="h-5 w-5 {getNotificationColor(
                                                    notification.type
                                                )}"
                                            />
                                        </div>

                                        <!-- 내용 -->
                                        <div class="min-w-0 flex-1">
                                            <div class="mb-1 flex items-center gap-2">
                                                <span
                                                    class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                >
                                                    {getNotificationTypeLabel(notification.type)}
                                                </span>
                                                {#if !notification.is_read}
                                                    <span
                                                        class="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                    >
                                                        NEW
                                                    </span>
                                                {/if}
                                            </div>
                                            <p class="text-foreground font-medium">
                                                {notification.title}
                                            </p>
                                            <p
                                                class="text-muted-foreground mt-1 line-clamp-2 text-sm"
                                            >
                                                {notification.content}
                                            </p>
                                            <p class="text-muted-foreground mt-2 text-xs">
                                                {formatTime(notification.created_at)}
                                            </p>
                                        </div>

                                        <!-- 삭제 버튼 -->
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                                            onclick={(e: Event) =>
                                                handleDeleteNotification(notification.id, e)}
                                        >
                                            <Trash2 class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="text-muted-foreground py-8 text-center">알림이 없습니다.</p>
                {/if}
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {#if notificationData.total_pages > 1}
            <div class="mt-6 flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                >
                    이전
                </Button>

                <span class="text-muted-foreground px-4 text-sm">
                    {data.page} / {notificationData.total_pages}
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === notificationData.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    다음
                </Button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
