<script lang="ts">
    import type { PageData } from './$types';
    let { data }: { data: PageData } = $props();
</script>

<svelte:head
    ><title>로그인 - 위키앙</title><meta name="robots" content="noindex, nofollow" /></svelte:head
>
<main class="wiki-account">
    <a href="/대문">← 위키앙으로 돌아가기</a>
    <h1>{data.wikiUser ? '내 위키앙 계정' : '위키앙 로그인'}</h1>
    {#if data.wikiUser}
        <p><strong>{data.wikiUser.nickname}</strong>님으로 로그인했습니다.</p>
        <p>편집 이력에는 위키앙 닉네임이 표시됩니다. 구글 이름과 이메일은 공개하지 않습니다.</p>
        <form method="POST" action="/wiki-auth/logout"><button>로그아웃</button></form>
    {:else}
        <p>
            구글 계정으로 위키앙에 로그인합니다. 처음 로그인하면 위키앙 전용 계정과 닉네임이
            만들어집니다.
        </p>
        <p>문서는 로그인 없이도 읽고 편집할 수 있습니다.</p>
        {#if data.failed}<p role="alert">
                로그인을 완료하지 못했습니다. 취소하거나 시간이 만료됐다면 다시 시도해주세요.
            </p>{/if}
        {#if data.configured}
            <a
                class="google-login"
                href={'/wiki-auth/google?returnTo=' + encodeURIComponent(data.returnTo)}
                data-sveltekit-reload>Google 계정으로 계속</a
            >
        {:else}
            <p role="status">
                구글 로그인을 준비 중입니다. 설정이 완료되면 이 화면에서 로그인할 수 있습니다.
            </p>
        {/if}
    {/if}
    <footer>운영: WIKIANG LLC</footer>
</main>

<style>
    .wiki-account {
        max-width: 520px;
        margin: 3rem auto;
        padding: 1.5rem;
        color: var(--foreground);
    }
    h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 1.5rem 0;
    }
    p {
        margin: 1rem 0;
        line-height: 1.7;
        overflow-wrap: anywhere;
    }
    a {
        color: var(--primary);
    }
    button,
    .google-login {
        display: inline-block;
        padding: 0.8rem 1rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--background);
        color: var(--foreground);
        cursor: pointer;
    }
    footer {
        margin-top: 2rem;
        color: var(--muted-foreground);
        font-size: 0.8rem;
    }
</style>
