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
    import {
        clearMessageUnreadCache,
        readMessageUnreadCache,
        writeMessageUnreadCache
    } from '$lib/utils/message-unread-cache';

    // 알림 배지와 동일한 폴링 주기 (3분).
    const POLL_INTERVAL_MS = 180_000;
    // 탭이 다시 보일 때 바로 부르지 않고 잠깐 기다린다 (알림 종과 동일). 탭을 빠르게
    // 오가는 경우 요청이 몰리지 않게 한다.
    const VISIBILITY_DEBOUNCE_MS = 5_000;

    let unreadCount = $state(0);
    let inflight: Promise<void> | null = null;
    // 강제 갱신이 진행 중 요청을 앞지르면, 늦게 도착한 옛 응답이 새 값을 덮지 않게 한다.
    let requestSeq = 0;

    function currentMbId(): string | null {
        return authStore.user?.mb_id || null;
    }

    /**
     * 안 읽은 쪽지 수를 불러온다.
     * - 기본: 30초 짧은 캐시(회원별)를 먼저 보고, 진행 중 요청이 있으면 합친다.
     * - force: 캐시를 건너뛰고 새로 부른다 (쪽지 읽음 이벤트, /messages 오갈 때).
     */
    async function loadUnreadCount(force = false): Promise<void> {
        if (!authStore.isAuthenticated) {
            unreadCount = 0;
            return;
        }
        const mbId = currentMbId();

        if (force) {
            clearMessageUnreadCache();
        } else {
            const cached = readMessageUnreadCache(mbId);
            if (cached !== null) {
                unreadCount = cached;
                return;
            }
            if (inflight) return inflight;
        }

        const seq = ++requestSeq;
        inflight = (async () => {
            try {
                const res = await apiClient.getUnreadMessageCount();
                if (seq !== requestSeq) return;
                // 응답 사이에 계정이 바뀌었으면 버린다.
                if (currentMbId() !== mbId) return;
                const count = res?.count ?? 0;
                unreadCount = count;
                writeMessageUnreadCache(mbId, count);
            } catch {
                // unread-count 실패 시 배지를 끄지 않고 기존 값 유지 (일시 오류로 깜박임 방지).
            } finally {
                // 더 새 요청(강제 갱신)이 시작됐으면 그 요청의 inflight 는 건드리지 않는다.
                if (seq === requestSeq) inflight = null;
            }
        })();
        return inflight;
    }

    // 로그인 → 로그아웃으로 바뀌면 캐시를 지운다 (처음부터 비로그인인 경우는 건드리지 않음).
    let wasAuthenticated = false;
    $effect(() => {
        const authed = authStore.isAuthenticated;
        if (wasAuthenticated && !authed) {
            clearMessageUnreadCache();
            unreadCount = 0;
        }
        wasAuthenticated = authed;
    });

    onMount(() => {
        // auth 초기화(layout onMount)가 완료된 뒤 호출하도록 약간 지연 (알림 패턴과 동일).
        if (document.visibilityState === 'visible') {
            setTimeout(() => void loadUnreadCount(), 200);
        }

        let interval: ReturnType<typeof setInterval> | null = null;
        let visibilityDebounce: ReturnType<typeof setTimeout> | null = null;

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
        function clearVisibilityDebounce() {
            if (visibilityDebounce) {
                clearTimeout(visibilityDebounce);
                visibilityDebounce = null;
            }
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                clearVisibilityDebounce();
                visibilityDebounce = setTimeout(() => {
                    visibilityDebounce = null;
                    void loadUnreadCount();
                    startPolling();
                }, VISIBILITY_DEBOUNCE_MS);
            } else {
                clearVisibilityDebounce();
                stopPolling();
            }
        }

        // 쪽지함 다이얼로그에서 읽기 성공 시 즉시 갱신 (messages/+page.svelte 가 발행)
        function handleMessagesRead() {
            void loadUnreadCount(true);
        }

        if (document.visibilityState === 'visible') startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('angple:messages-read', handleMessagesRead);

        return () => {
            stopPolling();
            clearVisibilityDebounce();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('angple:messages-read', handleMessagesRead);
        };
    });

    // /messages 를 방문하고 나오면(쪽지를 읽었을 가능성) 즉시 카운트 갱신.
    //
    // ⛔ `nav.from?.url?.pathname` — 옵셔널 체이닝을 **url 까지** 이어야 한다.
    //    `nav.from?.url?.pathname` 로 두면 from 이 있어도 from.url 이 null 일 때 터진다.
    //    타입상 NavigationTarget.url 은 non-nullable 이지만 **런타임은 다르다** —
    //    2026-08-21 실측: 3일간 111명(/free/write 96 · /hello/write 15).
    //    브라우저별 문구가 달라 별개 오류로 보였다:
    //      Chrome  "Cannot read properties of null (reading 'pathname')"
    //      Safari  "null is not an object (evaluating 'm.from?.url.pathname')"
    //    스택은 미니파이된 번들의 Set.forEach 안이라 afterNavigate 콜백임만 보였다.
    afterNavigate((nav) => {
        const from = nav.from?.url?.pathname;
        const to = nav.to?.url?.pathname;
        if (from?.startsWith('/messages') || to?.startsWith('/messages')) {
            void loadUnreadCount(true);
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
