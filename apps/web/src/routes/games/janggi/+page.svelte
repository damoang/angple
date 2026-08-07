<script lang="ts">
    import JanggiGame from '$lib/components/features/game/janggi-game.svelte';
    import JanggiOnline from '$lib/components/features/game/janggi-online.svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';

    // 초대 링크(?invite=)로 들어오면 온라인 탭을 바로 연다 — 오목과 동일 관례.
    let tab = $state<'ai' | 'online'>(
        typeof location !== 'undefined' && location.search.includes('invite=') ? 'online' : 'ai'
    );
</script>

<SeoHead
    config={{
        meta: { title: '장기', description: 'AI 연습과 온라인 대전을 지원하는 한국 전통 장기' },
        og: { title: '장기', type: 'website' }
    }}
/>

<div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">장기</h1>
        <p class="text-muted-foreground text-sm">AI 연습 또는 앙님들과 온라인 대국</p>
    </div>

    <div class="bg-muted mb-4 inline-flex gap-1 rounded-lg p-1">
        <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm {tab === 'ai'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'}"
            onclick={() => (tab = 'ai')}
        >
            AI와 연습
        </button>
        <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm {tab === 'online'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'}"
            onclick={() => (tab = 'online')}
        >
            온라인 대전
        </button>
    </div>

    {#if tab === 'ai'}
        <JanggiGame />
    {:else if authStore.isAuthenticated}
        <JanggiOnline />
    {:else}
        <div class="rounded-lg border p-6 text-center">
            <p class="text-sm">온라인 대전은 로그인 후 이용할 수 있습니다.</p>
            <a
                href="/login?redirect=%2Fgames%2Fjanggi"
                class="text-primary mt-2 inline-block text-sm underline"
            >
                로그인하기
            </a>
        </div>
    {/if}
</div>
