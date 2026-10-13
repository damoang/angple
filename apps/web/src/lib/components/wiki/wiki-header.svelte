<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte';
    import { onMount } from 'svelte';
    import { WIKI_SKINS, parseWikiSkin, type WikiSkin } from '$lib/wiki/skins';
    let { skin, onSkinChange }: { skin: WikiSkin; onSkinChange: (skin: WikiSkin) => void } =
        $props();
    import BookOpen from '@lucide/svelte/icons/book-open';
    import Search from '@lucide/svelte/icons/search';
    import Sun from '@lucide/svelte/icons/sun';
    import Moon from '@lucide/svelte/icons/moon';
    import { page } from '$app/stores';
    import { decodeWikiPath } from '$lib/wiki/paths';
    const links = [
        { href: '/대문', label: '대문' },
        { href: '/Special:AllPages', label: '모든 문서' },
        { href: '/Special:RecentChanges', label: '최근 바뀜' },
        { href: '/Special:Categories', label: '분류' }
    ];

    let dark = $state(false);
    let ready = $state(false);
    onMount(() => {
        dark =
            document.documentElement.classList.contains('dark') ||
            document.documentElement.classList.contains('amoled');
        ready = true;
    });

    function toggleTheme() {
        dark = !dark;
        document.documentElement.classList.remove('amoled');
        document.documentElement.classList.toggle('dark', dark);
        // Match app.html's early theme restoration and the shared header's storage keys.
        const theme = dark ? 'dark' : 'light';
        try {
            localStorage.setItem('themeMode', theme);
        } catch {
            // Cookie persistence still works when browser storage is unavailable.
        }
        document.cookie = `angple_theme_mode=${theme};path=/;max-age=31536000;SameSite=Lax`;
    }
</script>

<header class="site-header">
    <a class="skip" href="#wiki-main">본문으로 건너뛰기</a>
    <div class="top">
        <a class="brand" href="/대문" aria-label="위키앙 대문">
            <span class="brand-mark"><BookOpen size={28} strokeWidth={1.5} /></span>
            <span>위키앙<small>함께 쓰는 지식사전</small></span>
        </a>
        <form action="/Special:Search" method="GET" role="search">
            <Search size={18} aria-hidden="true" />
            <input
                name="q"
                aria-label="위키 문서 검색"
                placeholder="위키앙에서 검색"
                required
                maxlength="200"
            />
            <button class="search-button">검색</button>
        </form>
        <div class="personal">
            <label class="skin-picker"
                ><span class="sr-only">위키 테마</span><select
                    aria-label="위키 테마"
                    value={skin}
                    disabled={!ready}
                    onchange={(event) => onSkinChange(parseWikiSkin(event.currentTarget.value))}
                    >{#each WIKI_SKINS as item}<option value={item.value}>{item.label}</option
                        >{/each}</select
                ></label
            >
            <span class="sr-only" aria-live="polite"
                >{WIKI_SKINS.find((item) => item.value === skin)?.label} 적용</span
            >
            <button
                class="theme"
                onclick={toggleTheme}
                disabled={!ready}
                aria-label="화면 색상 전환"
                title={dark ? '밝은 화면' : '어두운 화면'}
            >
                {#if dark}<Sun size={20} />{:else}<Moon size={20} />{/if}
            </button>
            {#if authStore.user}<span class="account"
                    >{authStore.user.mb_name || authStore.user.mb_id}</span
                >{:else}<a class="account" href="/login">로그인</a>{/if}
        </div>
    </div>
    <div class="nav-row">
        <nav aria-label="위키 메뉴">
            {#each links as link}<a
                    href={link.href}
                    aria-current={decodeWikiPath($page.url.pathname) === link.href
                        ? 'page'
                        : undefined}>{link.label}</a
                >{/each}
        </nav>
        <a class="contribute" href="/Special:NewPage">+ 새 문서</a>
    </div>
</header>

<style>
    .site-header {
        background: var(--background);
        border-bottom: 1px solid var(--border);
    }
    .top,
    .nav-row {
        max-width: 1480px;
        margin: auto;
        padding: 0 2rem;
        display: flex;
        align-items: center;
    }
    .top {
        min-height: 94px;
        gap: 2.5rem;
    }
    .brand {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.06em;
        white-space: nowrap;
    }
    .brand-mark {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border: 1px solid var(--border);
        border-radius: 50%;
        color: var(--primary);
    }
    small {
        display: block;
        margin-top: 0.1rem;
        color: var(--muted-foreground);
        font-size: 0.68rem;
        font-weight: 400;
        letter-spacing: 0.04em;
    }
    form {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        max-width: 560px;
        flex: 1;
        border: 1px solid var(--border);
        border-radius: 5px;
        padding-left: 0.9rem;
        color: var(--muted-foreground);
        background: var(--background);
    }
    form:focus-within {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
    }
    input {
        min-width: 0;
        width: 100%;
        padding: 0.65rem 0;
        color: var(--foreground);
        background: transparent;
        outline: none;
        font-size: 0.9rem;
    }
    button {
        cursor: pointer;
        flex-shrink: 0;
    }
    .search-button {
        align-self: stretch;
        border-left: 1px solid var(--border);
        background: var(--muted);
        padding: 0 1rem;
        font-size: 0.85rem;
        color: var(--foreground);
    }
    .skin-picker select {
        width: 100px;
        padding: 0.5rem 0.35rem;
        font-size: 0.8rem;
        color: var(--foreground);
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 4px;
    }
    .skin-picker select:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
    }
    .personal {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-left: auto;
    }
    .theme {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
    }
    .theme:hover {
        background: var(--muted);
    }
    .account {
        font-size: 0.82rem;
        color: var(--primary);
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .nav-row {
        justify-content: space-between;
        gap: 0.75rem;
    }
    nav {
        display: flex;
        gap: 1.65rem;
    }
    nav a {
        padding: 0.7rem 0 0.8rem;
        border-bottom: 2px solid transparent;
        font-size: 0.85rem;
        color: var(--muted-foreground);
        white-space: nowrap;
    }
    nav a[aria-current='page'] {
        border-color: var(--primary);
        color: var(--primary);
        font-weight: 650;
    }
    nav a:hover {
        color: var(--primary);
    }
    .contribute {
        font-size: 0.82rem;
        color: var(--primary);
        font-weight: 600;
        white-space: nowrap;
    }
    .skip {
        position: absolute;
        left: 1rem;
        top: -100px;
        z-index: 100;
        padding: 0.8rem;
        background: var(--background);
        color: var(--primary);
    }
    .skip:focus {
        top: 1rem;
    }
    @media (max-width: 768px) {
        .top,
        .nav-row {
            padding: 0 1rem;
        }
        .top {
            flex-wrap: wrap;
            gap: 0.75rem;
            padding-top: 1rem;
            padding-bottom: 0.9rem;
        }
        .brand {
            font-size: 1.35rem;
        }
        .brand-mark {
            width: 38px;
            height: 38px;
        }
        .skin-picker select {
            width: 87px;
            font-size: 0.75rem;
        }
        .brand small {
            font-size: 0.62rem;
        }
        form {
            order: 3;
            flex-basis: 100%;
            max-width: none;
        }
        nav {
            gap: 1rem;
        }
        nav a,
        .contribute {
            font-size: 0.78rem;
        }
        .personal {
            gap: 0.3rem;
        }
    }
</style>
