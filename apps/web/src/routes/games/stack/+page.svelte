<script lang="ts">
    import { untrack } from 'svelte';
    import StackGame from '$lib/components/features/game/stack-game.svelte';
    import StackOnline from '$lib/components/features/game/stack-online.svelte';
    import StackLeaderboard from '$lib/components/features/game/stack-leaderboard.svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import { getGame } from '$lib/games/registry.js';
    import { authStore } from '$lib/stores/auth.svelte.js';

    const game = getGame('stack');

    type Tab = 'solo' | 'online' | 'board';
    const TABS: Array<{ id: Tab; label: string }> = [
        { id: 'solo', label: '혼자하기' },
        { id: 'online', label: '온라인 대전' },
        { id: 'board', label: '순위' }
    ];

    // 기본은 혼자하기. 초대 링크(?invite=)로 들어오면 온라인 대전을 연다.
    let tab = $state<Tab>('solo');
    let loginHref = $state('/login?redirect=%2Fgames%2Fstack');
    // 한 번 연 탭은 숨기기만 하고 계속 둔다 — 탭을 옮겨도 대전 연결·혼자하기 판이 끊기지 않게
    let onlineOpened = $state(false);
    let boardOpened = $state(false);
    /** 온라인 대전이 매칭 대기·준비·대전 중인가 (StackOnline 이 알려 준다) */
    let onlineBusy = $state(false);
    /** 대전 중에 다른 탭을 누르면 확인을 받는다 */
    let pendingTab = $state<Tab | null>(null);

    function open(t: Tab) {
        tab = t;
        pendingTab = null;
        if (t === 'online') onlineOpened = true;
        if (t === 'board') boardOpened = true;
    }

    function select(t: Tab) {
        if (t === tab) return;
        if (tab === 'online' && onlineBusy) {
            pendingTab = t;
            return;
        }
        open(t);
    }

    $effect(() =>
        untrack(() => {
            if (new URLSearchParams(location.search).has('invite')) {
                open('online');
                // 로그인하고 돌아와도 초대 링크가 살아 있게
                loginHref = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
            }
        })
    );
</script>

<SeoHead
    config={{
        meta: { title: game.name, description: game.description },
        og: { title: game.name, type: 'website' }
    }}
/>

<div class="mx-auto max-w-xl px-4 py-6">
    <div class="mb-4">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">{game.name}</h1>
        <p class="text-muted-foreground text-sm">{game.description}</p>
    </div>

    <div class="mb-4 grid grid-cols-3 gap-1 rounded-lg border p-1" role="tablist">
        {#each TABS as t (t.id)}
            <button
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                class="rounded-md px-2 py-1.5 text-sm {tab === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'}"
                onclick={() => select(t.id)}
            >
                {t.label}
            </button>
        {/each}
    </div>

    {#if pendingTab}
        <div
            class="mb-4 space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3"
            role="group"
            aria-label="온라인 대전 중 탭 이동 확인"
        >
            <p class="text-sm font-medium">온라인 대전이 진행 중입니다.</p>
            <p class="text-muted-foreground text-xs">
                다른 탭을 보는 동안에도 대전은 계속됩니다. 조작하지 않으면 자리 비움으로 패배하고
                참가비는 돌려받지 못합니다. 매칭 대기 중이면 상대가 정해져도 준비를 누를 수
                없습니다.
            </p>
            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                    onclick={() => (pendingTab = null)}>대전으로 돌아가기</button
                >
                <button
                    type="button"
                    class="bg-muted text-foreground rounded-md px-4 py-2 text-sm font-medium"
                    onclick={() => pendingTab && open(pendingTab)}>그래도 이동</button
                >
            </div>
        </div>
    {/if}

    <div class:hidden={tab !== 'solo'}>
        <StackGame active={tab === 'solo'} />
    </div>

    {#if onlineOpened}
        <div class:hidden={tab !== 'online'}>
            {#if authStore.isAuthenticated}
                <StackOnline active={tab === 'online'} bind:busy={onlineBusy} />
            {:else}
                <div class="rounded-lg border p-6 text-center">
                    <p class="text-sm">온라인 대전은 로그인 후 이용할 수 있습니다.</p>
                    <a href={loginHref} class="text-primary mt-2 inline-block text-sm underline">
                        로그인하기
                    </a>
                </div>
            {/if}
        </div>
    {/if}

    {#if boardOpened}
        <div class:hidden={tab !== 'board'}>
            <StackLeaderboard />
        </div>
    {/if}
</div>
