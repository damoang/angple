<script lang="ts">
    /**
     * 위키 문서 뷰 (모던 위키 chrome).
     *  - 브레드크럼 + 페이지 헤더(제목·메타·액션) + 본문 + 우측 TOC 레일
     *  - 본문 렌더: 코어 <Markdown>(marked+DOMPurify+prose). content_type markdown/html.
     *  - content 없고 content_raw 만(미변환 위키텍스트) → 안내 + escape 원문.
     *  - 헤딩(h2~h4)에 id 주입 → 우측 TOC 앵커 스크롤.
     */
    import type { PageData } from './$types';
    import WikiContent from '$lib/components/wiki/wiki-content.svelte';
    import SpecialPage from '$lib/components/wiki/special-page.svelte';
    import Toc from '$lib/components/wiki/toc.svelte';
    import Breadcrumbs from '$lib/components/wiki/breadcrumbs.svelte';
    import BacklinksPanel from '$lib/components/wiki/backlinks-panel.svelte';
    import { renderWiki } from '$lib/wiki/render';
    import { wikiHref } from '$lib/wiki/paths';
    import PencilIcon from '@lucide/svelte/icons/pencil';
    import HistoryIcon from '@lucide/svelte/icons/history';
    import MessageSquareIcon from '@lucide/svelte/icons/message-square';
    import FilePlusIcon from '@lucide/svelte/icons/file-plus';
    import SearchIcon from '@lucide/svelte/icons/search';

    const { data }: { data: PageData } = $props();

    const existingPaths = $derived(new Set<string>(data.existingWikilinkPaths || []));
    const source = $derived(data.wikiPage?.content ?? data.wikiPage?.content_raw ?? '');
    const headings = $derived(
        renderWiki(source, data.wikiPage?.content_type, existingPaths).headings
    );
    const pageUrl = $derived(wikiHref(data.wikiPage?.path || ''));
</script>

<svelte:head>
    {#if data.wikiPage}<link rel="canonical" href={`https://wikiang.org${pageUrl}`} />
    {:else}<meta name="robots" content="noindex, follow" />{/if}
    {#if data.wikiPage}
        <title>{data.wikiPage.title} - 위키앙</title>
        {#if data.wikiPage.description}
            <meta name="description" content={data.wikiPage.description} />
        {/if}
    {:else if data.isSpecialPage}
        <title>특수:{data.specialType} - 위키앙</title>
    {/if}
</svelte:head>

{#if data.isSpecialPage}
    {#if data.specialData}<SpecialPage special={data.specialData} />{/if}
{:else if data.notFound}
    <div class="wiki-shell">
        <article class="wiki-main wiki-not-found">
            <Breadcrumbs path={data.requestedPath || ''} />

            <header class="wiki-header">
                <h1 class="wiki-title">
                    {data.requestedTitle}
                </h1>
            </header>

            <div class="not-found-hero">
                <p class="not-found-msg">
                    이 문서는 아직 위키앙에 없습니다.
                    <strong>지금 만들어 첫 기여자가 되어보세요.</strong>
                </p>
                <div class="not-found-actions">
                    <a
                        class="not-found-cta"
                        href={`${(data.requestedPath || '')
                            .replace(/^\/+/, '')
                            .split('/')
                            .map(encodeURIComponent)
                            .map((s) => '/' + s)
                            .join('')}/edit`}
                    >
                        <FilePlusIcon class="h-4 w-4" /> 이 제목으로 새 문서 만들기
                    </a>
                    <a
                        class="not-found-secondary"
                        href={`/Special:Search?q=${encodeURIComponent(data.requestedTitle || '')}`}
                    >
                        <SearchIcon class="h-4 w-4" /> 비슷한 문서 검색
                    </a>
                </div>
            </div>

            {#if data.incomingLinks && data.incomingLinks.length > 0}
                <section class="not-found-section">
                    <h2>이 문서를 가리키는 다른 문서 ({data.incomingLinks.length})</h2>
                    <ul class="not-found-list">
                        {#each data.incomingLinks as bl (bl.id)}
                            <li>
                                <a
                                    href={'/' +
                                        bl.path
                                            .replace(/^\/+/, '')
                                            .split('/')
                                            .map(encodeURIComponent)
                                            .join('/')}>{bl.title}</a
                                >
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}

            {#if data.suggestions && data.suggestions.length > 0}
                <section class="not-found-section">
                    <h2>비슷한 제목의 문서</h2>
                    <ul class="not-found-list">
                        {#each data.suggestions as s (s.id)}
                            <li>
                                <a
                                    href={'/' +
                                        s.path
                                            .replace(/^\/+/, '')
                                            .split('/')
                                            .map(encodeURIComponent)
                                            .join('/')}>{s.title}</a
                                >
                                {#if s.description}<span class="not-found-desc">
                                        — {s.description}</span
                                    >{/if}
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}
        </article>
    </div>
{:else if data.wikiPage}
    <div class="wiki-shell">
        <article class="wiki-main">
            <Breadcrumbs path={data.wikiPage.path} />

            <header class="wiki-header">
                <h1 class="wiki-title">{data.wikiPage.title}</h1>
                <div class="wiki-actions">
                    <a class="wiki-action" href={`${pageUrl}/edit`}>
                        <PencilIcon class="h-3.5 w-3.5" /> 편집
                    </a>
                    <a class="wiki-action" href={`${pageUrl}/history`}>
                        <HistoryIcon class="h-3.5 w-3.5" /> 역사
                    </a>
                    <a class="wiki-action" href={wikiHref('/토론' + data.wikiPage.path)}>
                        <MessageSquareIcon class="h-3.5 w-3.5" /> 토론
                    </a>
                </div>
            </header>

            <div class="wiki-content">
                {#if source}
                    <WikiContent
                        content={source}
                        contentType={data.wikiPage.content_type}
                        {existingPaths}
                        path={data.wikiPage.path}
                    />
                {:else}<p>이 문서는 아직 내용이 없습니다. 편집으로 내용을 보완해주세요.</p>{/if}
            </div>

            <BacklinksPanel backlinks={data.backlinks || []} />

            <footer class="wiki-footer">
                마지막 수정: {new Date(data.wikiPage.updated_at).toLocaleString('ko-KR')}
            </footer>
        </article>

        {#if headings.length >= 3}
            <aside class="wiki-toc-rail">
                <Toc items={headings} />
            </aside>
        {/if}
    </div>
{/if}

<style>
    .wiki-shell {
        display: flex;
        gap: 2rem;
        align-items: flex-start;
        max-width: 1100px;
        margin: 0 auto;
    }
    .wiki-main {
        flex: 1 1 auto;
        min-width: 0;
    }
    .wiki-toc-rail {
        flex: 0 0 13.5rem;
        width: 13.5rem;
    }
    @media (max-width: 1024px) {
        .wiki-toc-rail {
            display: none;
        }
    }

    .wiki-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.5rem;
        border-bottom: 2px solid var(--border, #e5e7eb);
        padding-bottom: 0.5rem;
        margin-bottom: 1.25rem;
    }
    .wiki-title {
        overflow-wrap: anywhere;
        font-size: 1.9rem;
        font-weight: 700;
        line-height: 1.2;
        margin: 0;
    }
    .wiki-actions {
        display: flex;
        gap: 0.25rem;
    }
    .wiki-action {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.6rem;
        font-size: 0.8rem;
        color: var(--muted-foreground, #6b7280);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 0.375rem;
        text-decoration: none;
        white-space: nowrap;
    }
    .wiki-action:hover {
        color: var(--primary, #3366cc);
        border-color: var(--primary, #3366cc);
    }
    .wiki-content {
        line-height: 1.75;
    }
    /* 위키링크 — Markdown 컴포넌트가 렌더한 a.wiki-link 스타일 */
    .wiki-content :global(a.wiki-link) {
        color: var(--primary, #3366cc);
        text-decoration: none;
    }
    .wiki-content :global(a.wiki-link:hover) {
        text-decoration: underline;
    }
    .wiki-content :global(a.wiki-link.red-link) {
        color: #b91c1c;
    }
    .wiki-content :global(a.wiki-link.red-link:hover) {
        color: #7f1d1d;
        text-decoration: underline dashed;
    }
    .wiki-footer {
        margin-top: 2rem;
        border-top: 1px solid var(--border, #e5e7eb);
        padding-top: 1rem;
        font-size: 0.8rem;
        color: var(--muted-foreground, #6b7280);
    }

    /* 404 / not-found wiki-aware 페이지 */
    .wiki-not-found .wiki-title {
        color: var(--muted-foreground, #6b7280);
    }
    .not-found-hero {
        margin: 1.5rem 0 2rem;
        padding: 1.5rem;
        background: var(--muted, #f8fafc);
        border: 1px dashed var(--border, #cbd5e1);
        border-radius: 0.5rem;
    }
    .not-found-msg {
        margin: 0 0 1rem;
        font-size: 0.95rem;
        color: var(--foreground, #0f172a);
    }
    .not-found-msg strong {
        color: var(--primary, #3366cc);
    }
    .not-found-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .not-found-cta {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: var(--primary, #3366cc);
        color: white;
        border-radius: 0.375rem;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
    }
    .not-found-cta:hover {
        opacity: 0.92;
    }
    .not-found-secondary {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: white;
        color: var(--foreground, #0f172a);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 0.375rem;
        text-decoration: none;
        font-size: 0.9rem;
    }
    .not-found-secondary:hover {
        border-color: var(--primary, #3366cc);
        color: var(--primary, #3366cc);
    }
    .not-found-section {
        margin-top: 2rem;
    }
    .not-found-section h2 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 0.6rem;
        color: var(--muted-foreground, #6b7280);
    }
    .not-found-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.4rem 1rem;
    }
    .not-found-list li {
        font-size: 0.88rem;
        line-height: 1.4;
    }
    .not-found-list a {
        color: var(--primary, #3366cc);
        text-decoration: none;
    }
    .not-found-list a:hover {
        text-decoration: underline;
    }
    .not-found-desc {
        color: var(--muted-foreground, #6b7280);
        font-size: 0.8rem;
    }

    /* 깨진 외부 이미지 우아한 대체 */
    .wiki-content :global(.wiki-img-broken) {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        margin: 0.25rem 0;
        background: #fef3c7;
        color: #92400e;
        border: 1px dashed #fbbf24;
        border-radius: 0.375rem;
        font-size: 0.82rem;
        cursor: help;
    }
</style>
