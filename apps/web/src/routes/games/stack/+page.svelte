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

    $effect(() =>
        untrack(() => {
            if (new URLSearchParams(location.search).has('invite')) {
                tab = 'online';
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
                onclick={() => (tab = t.id)}
            >
                {t.label}
            </button>
        {/each}
    </div>

    {#if tab === 'solo'}
        <StackGame />
    {:else if tab === 'online'}
        {#if authStore.isAuthenticated}
            <StackOnline />
        {:else}
            <div class="rounded-lg border p-6 text-center">
                <p class="text-sm">온라인 대전은 로그인 후 이용할 수 있습니다.</p>
                <a
                    href={loginHref}
                    class="text-primary mt-2 inline-block text-sm underline"
                >
                    로그인하기
                </a>
            </div>
        {/if}
    {:else}
        <StackLeaderboard />
    {/if}
</div>
