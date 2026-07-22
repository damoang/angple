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
    import Users from '@lucide/svelte/icons/users';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { toast } from 'svelte-sonner';
    import { formatMemberCount, subscribeCtaLabel, subscribeCtaTitle } from './subscribe-cta.js';

    interface Props {
        boardId: string;
        boardTitle: string;
        /**
         * 'icon'(기본) = 기존 벨 아이콘. 모든 일반 게시판에서 그대로 동작(회귀 0).
         * 'prominent' = 소모임(gr_id='group') 전용 강화 CTA. 라벨 + 구독자수("멤버 N명")를
         *               항상 노출하고, 마운트 시 구독 상태를 미리 로드한다.
         */
        variant?: 'icon' | 'prominent';
    }

    let { boardId, boardTitle, variant = 'icon' }: Props = $props();

    const isProminent = $derived(variant === 'prominent');

    let isSubscribed = $state(false);
    let level = $state<1 | 2 | 3 | null>(null);
    let subscriberCount = $state(0);
    // 글 많은 게시판 — '인기글만' 추천 + '전체' 대량 경고 (#12607 폭주 방지)
    let busy = $state(false);
    let loading = $state(false);
    let stateLoaded = $state(false);
    let stateLoading = $state(false);

    // #12875: SvelteKit 은 같은 [boardId] 라우트 내 이동(예: /nyangs → /free)에서 이 컴포넌트를
    // 재마운트하지 않고 boardId prop 만 바꾼다. stateLoaded 가 남아 있으면 이전 게시판의 구독
    // 상태가 새 게시판에 그대로 표시된다. boardId 변경 시 상태를 초기화해, 다음 hover/open 에서
    // 새 게시판을 다시 로드하도록 한다.
    $effect(() => {
        void boardId; // 의존성 추적
        stateLoaded = false;
        stateLoading = false;
        isSubscribed = false;
        level = null;
        subscriberCount = 0;
        busy = false;
    });

    // 소모임(prominent) CTA 는 구독자수·"멤버" 표기를 즉시 보여줘야 하므로, hover 를 기다리지 않고
    // 마운트/보드 전환 시 상태를 미리 로드한다. 위 리셋 $effect 뒤에 선언해 리셋 후 실행되도록 한다.
    // 일반 게시판(variant='icon')은 이 경로를 타지 않아 기존 동작 그대로(회귀 0).
    $effect(() => {
        void boardId; // 보드 전환 시 재프라임
        if (isProminent) {
            primeSubscribeState();
        }
    });

    async function loadSubscribeState(): Promise<void> {
        if (stateLoaded || stateLoading) return;
        // 요청 시작 시점의 boardId 를 캡처. 응답 도착 전에 게시판이 바뀌면(SPA 이동) 이 응답은
        // 이전 게시판 것이므로 폐기한다 — stale 응답이 새 게시판에 커밋되어 고착되는 레이스 방지(#12875).
        const reqBoard = boardId;
        stateLoading = true;
        try {
            const res = await fetch(`/api/boards/${reqBoard}/subscribe`);
            if (reqBoard !== boardId) return; // 그 사이 게시판 전환됨 → 폐기
            if (res.ok) {
                const data = await res.json();
                if (reqBoard !== boardId) return;
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
            // stale 응답이면 현재 게시판 상태(로드 가드)를 건드리지 않는다.
            if (reqBoard === boardId) {
                stateLoaded = true;
                stateLoading = false;
            }
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
            {#if isProminent}
                <!-- 소모임 전용 강화 CTA: 라벨 + "멤버 N명" 노출로 구독을 멤버십처럼 -->
                <Button
                    {...props}
                    variant={isSubscribed ? 'secondary' : 'default'}
                    size="sm"
                    onmouseenter={primeSubscribeState}
                    onfocus={primeSubscribeState}
                    disabled={loading}
                    aria-label={isSubscribed ? '소모임 멤버 · 알림 설정' : '소모임 구독하기'}
                    title={subscribeCtaTitle(boardTitle, isSubscribed, subscriberCount)}
                    class="h-8 gap-1.5 px-3"
                >
                    {#if isSubscribed}
                        <Bell class="h-4 w-4" fill="currentColor" />
                    {:else}
                        <Users class="h-4 w-4" />
                    {/if}
                    <span class="text-sm font-medium">{subscribeCtaLabel(isSubscribed)}</span>
                    {#if subscriberCount > 0}
                        <span
                            class="ml-0.5 border-l pl-1.5 text-xs font-normal opacity-80"
                            class:border-primary-foreground={!isSubscribed}
                        >
                            {formatMemberCount(subscriberCount)}
                        </span>
                    {/if}
                </Button>
            {:else}
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
            {/if}
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
