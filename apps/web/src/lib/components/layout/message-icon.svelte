<script lang="ts">
    // 헤더 쪽지 아이콘 + 미읽음 배지.
    // 알림 종(notification-dropdown.svelte)의 unread-count 폴링 패턴과 동일하게
    // /api/v1/messages/unread-count 를 폴링해 미읽음 개수를 배지로 표시한다.
    // 배경: 배지가 없어 사용자가 쪽지 수신을 인지하지 못해 3개월간 열람 기록 0건이었음
    // (docs/2026-06-05-memo-read-tracking-diagnosis.md "남은 작업 2번").
    import { onMount } from 'svelte';
    import { goto, afterNavigate } from '$app/navigation';
    import Mail from '@lucide/svelte/icons/mail';
    import { apiClient } from '$lib/api/client';
    import { authStore } from '$lib/stores/auth.svelte.js';

    // 알림 배지와 동일한 폴링 주기 (3분).
    const POLL_INTERVAL_MS = 180_000;

    let unreadCount = $state(0);
    let inflight: Promise<void> | null = null;

    async function loadUnreadCount(): Promise<void> {
        if (!authStore.isAuthenticated) {
            unreadCount = 0;
            return;
        }
        if (inflight) return inflight;
        inflight = (async () => {
            try {
                const res = await apiClient.getUnreadMessageCount();
                unreadCount = res?.count ?? 0;
            } catch {
                // unread-count 실패 시 배지를 끄지 않고 기존 값 유지 (일시 오류로 깜박임 방지).
            } finally {
                inflight = null;
            }
        })();
        return inflight;
    }

    onMount(() => {
        // auth 초기화(layout onMount)가 완료된 뒤 호출하도록 약간 지연 (알림 패턴과 동일).
        if (document.visibilityState === 'visible') {
            setTimeout(() => void loadUnreadCount(), 200);
        }

        let interval: ReturnType<typeof setInterval> | null = null;

        function startPolling() {
            if (interval) return;
            interval = setInterval(() => void loadUnreadCount(), POLL_INTERVAL_MS);
        }
        function stopPolling() {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                void loadUnreadCount();
                startPolling();
            } else {
                stopPolling();
            }
        }

        // 쪽지함 다이얼로그에서 읽기 성공 시 즉시 갱신 (messages/+page.svelte 가 발행)
        function handleMessagesRead() {
            void loadUnreadCount();
        }

        if (document.visibilityState === 'visible') startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('angple:messages-read', handleMessagesRead);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('angple:messages-read', handleMessagesRead);
        };
    });

    // /messages 를 방문하고 나오면(쪽지를 읽었을 가능성) 즉시 카운트 갱신.
    afterNavigate((nav) => {
        const from = nav.from?.url.pathname;
        const to = nav.to?.url.pathname;
        if (from?.startsWith('/messages') || to?.startsWith('/messages')) {
            void loadUnreadCount();
        }
    });
</script>

<button
    onclick={() => goto('/messages')}
    class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out"
    aria-label={unreadCount > 0 ? `쪽지 (미읽음 ${unreadCount}개)` : '쪽지'}
>
    <span class="pointer-events-none absolute -inset-1"></span>
    <Mail class="text-muted-foreground h-5 w-5" />
    {#if unreadCount > 0}
        <span
            class="bg-primary noti-pulse absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
            >{unreadCount > 99 ? '99+' : unreadCount}</span
        >
    {/if}
</button>

<style>
    /* 미읽음 인디케이터 펄스 (알림 배지와 동일) */
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
