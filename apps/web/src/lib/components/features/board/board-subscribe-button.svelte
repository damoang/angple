<script lang="ts">
    /**
     * 게시판 구독 버튼
     * 게시판 헤더에 벨 아이콘으로 표시
     * 구독 시 새 글 알림을 받을 수 있음
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import Bell from '@lucide/svelte/icons/bell';
    import BellOff from '@lucide/svelte/icons/bell-off';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { toast } from 'svelte-sonner';
    import { onMount } from 'svelte';

    interface Props {
        boardId: string;
        boardTitle: string;
    }

    let { boardId, boardTitle }: Props = $props();

    let isSubscribed = $state(false);
    let subscriberCount = $state(0);
    let loading = $state(false);
    let initialized = $state(false);

    async function loadSubscribeState(): Promise<void> {
        try {
            const res = await fetch(`/api/boards/${boardId}/subscribe`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isSubscribed = data.data.is_subscribed;
                    subscriberCount = data.data.subscriber_count;
                }
            }
        } catch {
            // 조회 실패 시 무시
        } finally {
            initialized = true;
        }
    }

    onMount(() => {
        const task = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                initialized = true;
                return;
            }
            void loadSubscribeState();
        };

        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(task, { timeout: 2000 });
            return;
        }

        const timer = globalThis.setTimeout(task, 300);
        return () => {
            globalThis.clearTimeout(timer);
        };
    });

    async function toggle(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        loading = true;
        try {
            const method = isSubscribed ? 'DELETE' : 'POST';
            const res = await fetch(`/api/boards/${boardId}/subscribe`, { method });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isSubscribed = data.data.is_subscribed;
                    subscriberCount = data.data.subscriber_count;
                    toast.success(
                        isSubscribed
                            ? `'${boardTitle}' 구독 완료 — 새 글 알림을 받습니다`
                            : `'${boardTitle}' 구독 해제`
                    );
                }
            }
        } catch {
            toast.error('구독 처리에 실패했습니다.');
        } finally {
            loading = false;
        }
    }
</script>

{#if initialized}
    <Button
        variant="ghost"
        size="icon"
        onclick={toggle}
        disabled={loading}
        aria-label={isSubscribed ? '구독 해제' : '새 글 알림 구독'}
        aria-pressed={isSubscribed}
        title={isSubscribed
            ? `'${boardTitle}' 구독 중 (${subscriberCount}명) — 클릭하여 해제`
            : `'${boardTitle}' 구독하기 — 새 글 알림 받기${subscriberCount > 0 ? ` (${subscriberCount}명 구독 중)` : ''}`}
        class="relative h-8 w-8 {isSubscribed
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground hover:text-primary'}"
    >
        <span class="absolute -inset-2"></span>
        {#if isSubscribed}
            <Bell class="h-4 w-4" fill="currentColor" />
        {:else}
            <BellOff class="h-4 w-4" />
        {/if}
    </Button>
{/if}
