<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte';
    import { mode, toggleMode } from 'mode-watcher';
</script>

<header>
    <div class="top">
        <a class="brand" href="/대문">위키앙<span>함께 만드는 지식사전</span></a>
        <form action="/Special:Search" method="GET">
            <input
                name="q"
                aria-label="위키 문서 검색"
                placeholder="문서 검색"
                required
                maxlength="200"
            /><button>검색</button>
        </form>
        <button class="theme" onclick={toggleMode} aria-label="화면 색상 전환"
            >{mode.current === 'dark' ? '☀' : '☾'}</button
        >
    </div>
    <nav aria-label="위키 메뉴">
        <a href="/대문">대문</a><a href="/Special:AllPages">모든 문서</a><a
            href="/Special:RecentChanges">최근 바뀜</a
        ><a href="/Special:Categories">분류</a><a href="/Special:NewPage">새 문서</a><a
            href="/도움말">도움말</a
        ><a href="https://damoang.net">다모앙 ↗</a>{#if authStore.user}<span
                >{authStore.user.mb_name || authStore.user.mb_id}</span
            >{:else}<a href="/login">로그인</a>{/if}
    </nav>
</header>

<style>
    header {
        border-bottom: 1px solid var(--border);
        background: var(--background);
    }
    .top {
        max-width: 1400px;
        margin: auto;
        padding: 1rem;
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    .brand {
        font-weight: 800;
        font-size: 1.6rem;
        color: var(--primary);
        white-space: nowrap;
    }
    .brand span {
        display: block;
        font-size: 0.7rem;
        font-weight: 400;
        color: var(--muted-foreground);
    }
    form {
        display: flex;
        flex: 1;
        max-width: 600px;
        margin-left: auto;
        gap: 0.4rem;
    }
    input {
        min-width: 0;
        width: 100%;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--border);
        border-radius: 0.4rem;
        background: var(--muted);
    }
    button {
        padding: 0.5rem 0.65rem;
        flex-shrink: 0;
        border-radius: 0.4rem;
        background: var(--muted);
        cursor: pointer;
    }
    nav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem 1rem;
        max-width: 1400px;
        padding: 0 1rem 0.8rem;
        margin: auto;
        font-size: 0.85rem;
    }
    nav a {
        padding: 0.25rem 0;
    }
    nav a:hover {
        color: var(--primary);
        text-decoration: underline;
    }
    @media (max-width: 500px) {
        .top {
            gap: 0.5rem;
        }
        .brand span {
            display: none;
        }
        .brand {
            font-size: 1.3rem;
        }
        .theme {
            padding: 0.4rem;
        }
    }
</style>
