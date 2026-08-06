<script lang="ts">
    import OmokGame from '$lib/components/features/game/omok-game.svelte';
    import OmokOnline from '$lib/components/features/game/omok-online.svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';

    // 온라인 대전은 로그인·참가비가 필요하므로 기본 탭은 AI 연습으로 둔다.
    let tab = $state<'ai' | 'online'>('ai');
</script>

<SeoHead
    config={{
        meta: { title: '오목', description: '15x15 바둑판 위의 오목 대결' },
        og: { title: '오목', type: 'website' }
    }}
/>

<div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">오목</h1>
        <p class="text-muted-foreground text-sm">5줄을 먼저 만들면 승리합니다.</p>
    </div>

    <div class="mb-4 inline-flex rounded-lg border p-1">
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
        <OmokGame />
    {:else if authStore.isAuthenticated}
        <OmokOnline />
    {:else}
        <div class="rounded-lg border p-6 text-center">
            <p class="text-sm">온라인 대전은 로그인 후 이용할 수 있습니다.</p>
            <a
                href="/login?redirect=%2Fgames%2Fomok"
                class="text-primary mt-2 inline-block text-sm underline"
            >
                로그인하기
            </a>
        </div>
    {/if}
</div>
