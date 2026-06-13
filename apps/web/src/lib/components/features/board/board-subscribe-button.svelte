<script lang="ts">
    /**
     * 게시판 구독 버튼
     * 게시판 헤더에 벨 아이콘으로 표시. 클릭 시 구독 단계를 선택한다.
     *  - 전체 알림(level=1): 새 글마다 알림
     *  - 인기글만(level=2): 추천을 많이 받은 인기글만 알림 (글 많은 게시판 권장)
     *  - 구독 안 함: 구독 해제
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import Bell from '@lucide/svelte/icons/bell';
    import BellOff from '@lucide/svelte/icons/bell-off';
    import Check from '@lucide/svelte/icons/check';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { toast } from 'svelte-sonner';

    interface Props {
        boardId: string;
        boardTitle: string;
    }

    let { boardId, boardTitle }: Props = $props();

    let isSubscribed = $state(false);
    let level = $state<1 | 2 | 3 | null>(null);
    let subscriberCount = $state(0);
    // 글 많은 게시판 — '인기글만' 추천 + '전체' 대량 경고 (#12607 폭주 방지)
    let busy = $state(false);
    let loading = $state(false);
    let stateLoaded = $state(false);
    let stateLoading = $state(false);

    async function loadSubscribeState(): Promise<void> {
        if (stateLoaded || stateLoading) return;
        stateLoading = true;
        try {
            const res = await fetch(`/api/boards/${boardId}/subscribe`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isSubscribed = data.data.is_subscribed;
                    level = data.data.level ?? null;
                    subscriberCount = data.data.subscriber_count;
                    busy = data.data.busy ?? false;
                }
            }
        } catch {
            // 조회 실패 시 무시
        } finally {
            stateLoaded = true;
            stateLoading = false;
        }
    }

    function primeSubscribeState(): void {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return;
        }
        void loadSubscribeState();
    }

    function onOpenChange(open: boolean): void {
        if (open) {
            if (!authStore.isAuthenticated) {
                authStore.redirectToLogin();
                return;
            }
            void loadSubscribeState();
        }
    }

    /** 구독 단계 설정 (1=전체 / 2=인기글만 / 3=요약) */
    async function setLevel(next: 1 | 2 | 3): Promise<void> {
        if (loading) return;
        loading = true;
        try {
            const res = await fetch(`/api/boards/${boardId}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: next })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isSubscribed = data.data.is_subscribed;
                    level = data.data.level ?? next;
                    subscriberCount = data.data.subscriber_count;
                    toast.success(
                        next === 3
                            ? `'${boardTitle}' 새 글을 모아서 알려드립니다`
                            : next === 2
                              ? `'${boardTitle}' 인기글 알림을 받습니다`
                              : `'${boardTitle}' 새 글 알림을 받습니다`
                    );
                }
            }
        } catch {
            toast.error('구독 처리에 실패했습니다.');
        } finally {
            loading = false;
        }
    }

    /** 구독 해제 */
    async function unsubscribe(): Promise<void> {
        if (loading || !isSubscribed) return;
        loading = true;
        try {
            const res = await fetch(`/api/boards/${boardId}/subscribe`, { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isSubscribed = data.data.is_subscribed;
                    level = null;
                    subscriberCount = data.data.subscriber_count;
                    toast.success(`'${boardTitle}' 구독 해제`);
                }
            }
        } catch {
            toast.error('구독 처리에 실패했습니다.');
        } finally {
            loading = false;
        }
    }
</script>

<DropdownMenu.Root {onOpenChange}>
    <DropdownMenu.Trigger>
        {#snippet child({ props })}
            <Button
                {...props}
                variant="ghost"
                size="icon"
                onmouseenter={primeSubscribeState}
                onfocus={primeSubscribeState}
                disabled={loading}
                aria-label={isSubscribed ? '구독 설정' : '새 글 알림 구독'}
                title={isSubscribed
                    ? `'${boardTitle}' 구독 중 (${subscriberCount}명) — 클릭하여 설정`
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
        {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-56">
        <DropdownMenu.Label>{boardTitle} 알림</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onclick={() => setLevel(1)}>
            <div class="flex flex-1 flex-col">
                <span>전체 알림</span>
                <span class="text-muted-foreground text-xs">
                    {busy ? '글이 매우 많아 알림이 쏟아질 수 있어요' : '새 글이 올라올 때마다 알림'}
                </span>
            </div>
            {#if isSubscribed && level === 1}
                <Check class="text-primary h-4 w-4" />
            {/if}
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setLevel(2)}>
            <div class="flex flex-1 flex-col">
                <span class="flex items-center gap-1">
                    인기글만
                    {#if busy}
                        <span
                            class="bg-primary/10 text-primary rounded px-1 text-[10px] font-medium"
                            >추천</span
                        >
                    {/if}
                </span>
                <span class="text-muted-foreground text-xs">추천을 많이 받은 글만 알림</span>
            </div>
            {#if isSubscribed && level === 2}
                <Check class="text-primary h-4 w-4" />
            {/if}
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => setLevel(3)}>
            <div class="flex flex-1 flex-col">
                <span>요약 알림</span>
                <span class="text-muted-foreground text-xs">새 글을 하루 1~2회 모아서 알림</span>
            </div>
            {#if isSubscribed && level === 3}
                <Check class="text-primary h-4 w-4" />
            {/if}
        </DropdownMenu.Item>
        {#if isSubscribed}
            <DropdownMenu.Separator />
            <DropdownMenu.Item
                onclick={unsubscribe}
                class="text-destructive focus:text-destructive"
            >
                구독 안 함
            </DropdownMenu.Item>
        {/if}
    </DropdownMenu.Content>
</DropdownMenu.Root>
