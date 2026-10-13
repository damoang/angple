<script lang="ts">
    /**
     * 위키 전용 레이아웃 (Wiki.js 룩).
     *  헤더 + [좌측 페이지트리 | 본문(children)] + 푸터.
     *  루트 +layout.svelte 가 위키 라우트에 한해 DefaultLayout(보드 사이드바)을 우회하므로
     *  여기서 위키 chrome 을 직접 구성한다.
     */
    import WikiHeader from '$lib/components/wiki/wiki-header.svelte';

    import PageTree from '$lib/components/wiki/page-tree.svelte';
    import { page } from '$app/stores';

    let { children, data } = $props();

    const currentPath = $derived(decodeURIComponent($page.url.pathname));
</script>

<div class="wiki-layout">
    <WikiHeader />

    <div class="wiki-body">
        <aside class="wiki-nav">
            <PageTree nodes={data.pageTree ?? []} {currentPath} />
        </aside>
        <main class="wiki-main-col">
            {@render children()}
        </main>
    </div>

    <footer class="wiki-bottom">
        <a href="/위키앙:이용_규칙">이용 규칙</a><a href="/위키앙:저작권">저작권</a><a
            href="/도움말">도움말</a
        ><span>함께 읽고 고치는 지식사전, 위키앙</span>
    </footer>
</div>

<style>
    .wiki-bottom {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: center;
        padding: 1.5rem;
        border-top: 1px solid var(--border);
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }
    .wiki-layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }
    .wiki-body {
        display: flex;
        flex: 1;
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
        gap: 1.5rem;
        padding: 1.25rem 1rem;
        align-items: flex-start;
    }
    .wiki-nav {
        flex: 0 0 15rem;
        width: 15rem;
        position: sticky;
        top: 4.5rem;
        max-height: calc(100vh - 6rem);
        overflow-y: auto;
        padding-right: 0.5rem;
        border-right: 1px solid var(--border, #e5e7eb);
    }
    .wiki-main-col {
        flex: 1 1 auto;
        min-width: 0;
    }
    @media (max-width: 768px) {
        .wiki-nav {
            display: none;
        }
        .wiki-body {
            padding: 1rem;
        }
    }
</style>
