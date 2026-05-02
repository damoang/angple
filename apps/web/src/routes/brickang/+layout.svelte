<script lang="ts">
    import { page } from '$app/stores';

    interface Props {
        children?: import('svelte').Snippet;
    }
    let { children }: Props = $props();

    const tabs = [
        { href: '/brickang', label: '메인' },
        { href: '/brickang/ranking', label: '랭킹' },
        { href: '/brickang/my', label: '내 벽돌' }
    ];

    const path = $derived($page.url.pathname);
</script>

<div class="brickang-layout">
    <nav class="brickang-nav">
        <div class="brickang-nav__inner">
            <a href="/brickang" class="brickang-nav__brand">브릭앙</a>
            <div class="brickang-nav__tabs">
                {#each tabs as t (t.href)}
                    <a
                        href={t.href}
                        class="brickang-nav__tab"
                        class:brickang-nav__tab--active={path === t.href ||
                            (t.href !== '/brickang' && path.startsWith(t.href))}
                    >
                        {t.label}
                    </a>
                {/each}
            </div>
        </div>
    </nav>

    <main class="brickang-layout__content">
        {@render children?.()}
    </main>
</div>

<style>
    .brickang-layout {
        min-height: 100vh;
    }
    .brickang-nav {
        background-color: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
    }
    .brickang-nav__inner {
        max-width: 960px;
        margin: 0 auto;
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }
    .brickang-nav__brand {
        font-size: 1.125rem;
        font-weight: 700;
        color: #111827;
        text-decoration: none;
    }
    .brickang-nav__tabs {
        display: flex;
        gap: 0.25rem;
    }
    .brickang-nav__tab {
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        color: #6b7280;
        text-decoration: none;
        font-size: 0.875rem;
    }
    .brickang-nav__tab--active {
        background-color: #eff6ff;
        color: #1d4ed8;
        font-weight: 600;
    }
    .brickang-layout__content {
        padding-bottom: 3rem;
    }
</style>
