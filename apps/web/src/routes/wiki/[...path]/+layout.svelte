<script lang="ts">
    /**
     * 위키 전용 레이아웃 (Wiki.js 룩).
     *  헤더 + [좌측 페이지트리 | 본문(children)] + 푸터.
     *  루트 +layout.svelte 가 위키 라우트에 한해 DefaultLayout(보드 사이드바)을 우회하므로
     *  여기서 위키 chrome 을 직접 구성한다.
     */
    import Header from '$lib/components/layout/header.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import PageTree from '$lib/components/wiki/page-tree.svelte';
    import { page } from '$app/stores';

    let { children, data } = $props();

    const currentPath = $derived(decodeURIComponent($page.url.pathname));
</script>

<div class="wiki-layout">
    <Header />

    <div class="wiki-body">
        <aside class="wiki-nav">
            <PageTree nodes={data.pageTree ?? []} {currentPath} />
        </aside>
        <main class="wiki-main-col">
            {@render children()}
        </main>
    </div>

    <Footer />
</div>

<style>
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
