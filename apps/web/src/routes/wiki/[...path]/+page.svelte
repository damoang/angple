<script lang="ts">
    /**
     * 위키 문서 뷰 (모던 위키 chrome).
     *  - 브레드크럼 + 페이지 헤더(제목·메타·액션) + 본문 + 우측 TOC 레일
     *  - 본문 렌더: 코어 <Markdown>(marked+DOMPurify+prose). content_type markdown/html.
     *  - content 없고 content_raw 만(미변환 위키텍스트) → 안내 + escape 원문.
     *  - 헤딩(h2~h4)에 id 주입 → 우측 TOC 앵커 스크롤.
     */
    import type { PageData } from './$types';
    import { Markdown } from '$lib/components/ui/markdown/index.js';
    import Toc from '$lib/components/wiki/toc.svelte';
    import Breadcrumbs from '$lib/components/wiki/breadcrumbs.svelte';
    import BacklinksPanel from '$lib/components/wiki/backlinks-panel.svelte';
    import { slugify } from '$lib/components/wiki/heading-slug';
    import PencilIcon from '@lucide/svelte/icons/pencil';
    import HistoryIcon from '@lucide/svelte/icons/history';
    import MessageSquareIcon from '@lucide/svelte/icons/message-square';
    import FilePlusIcon from '@lucide/svelte/icons/file-plus';
    import SearchIcon from '@lucide/svelte/icons/search';
    import { tick } from 'svelte';

    const { data }: { data: PageData } = $props();

    // 존재하는 위키링크 path set (data 에서 받음)
    const existingPaths = $derived(new Set<string>(data.existingWikilinkPaths || []));

    function encodePath(p: string): string {
        const trimmed = p.replace(/^\/+/, '');
        return '/' + trimmed.split('/').map(encodeURIComponent).join('/');
    }

    /**
     * `[[path]]` 또는 `[[path|label]]` 위키링크를 <a> 태그로 변환.
     * - 존재하는 path: `wiki-link` 클래스 (파란)
     * - 없는 path: `wiki-link red-link` 클래스 (빨강) — 클릭 시 새 문서 생성 흐름
     * - 코드 펜스 / inline code 안의 [[..]] 는 보존
     */
    function transformWikilinks(content: string, existing: Set<string>): string {
        if (!content) return content;
        const placeholders: string[] = [];
        let stripped = content.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
            placeholders.push(m);
            return `\x00CODE${placeholders.length - 1}\x00`;
        });
        stripped = stripped.replace(
            /\[\[([^\]\n|]+?)(?:\|([^\]\n]+))?\]\]/g,
            (full, raw: string, label?: string) => {
                const trimmed = raw.trim();
                if (!trimmed) return full;
                const path = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
                const display = (label?.trim() || trimmed.replace(/^\//, '').replace(/_/g, ' '))
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const exists = existing.has(path);
                const href = encodePath(path);
                const cls = exists ? 'wiki-link' : 'wiki-link red-link';
                const title = exists ? path : `${path} (없는 문서)`;
                return `<a class="${cls}" href="${href}" title="${title}">${display}</a>`;
            }
        );
        return stripped.replace(/\x00CODE(\d+)\x00/g, (_, i) => placeholders[parseInt(i, 10)]);
    }

    type Renderable =
        | { mode: 'rich'; content: string }
        | { mode: 'raw'; content: string; type: string }
        | null;

    function pickRenderable(
        page: {
            content: string | null;
            content_raw: string | null;
            content_type: string | null;
        } | null,
        existing: Set<string>
    ): Renderable {
        if (!page) return null;
        const ct = page.content_type;
        if (page.content && (ct === 'markdown' || ct === 'html')) {
            // markdown/html 둘 다 [[..]] 변환 적용 (html 본문도 위키링크 허용)
            return { mode: 'rich', content: transformWikilinks(page.content, existing) };
        }
        if (page.content_raw) {
            return { mode: 'raw', content: page.content_raw, type: ct || 'unknown' };
        }
        if (page.content) {
            return { mode: 'raw', content: page.content, type: ct || 'unknown' };
        }
        return null;
    }

    const renderable = $derived(pickRenderable(data.wikiPage, existingPaths));
    const tocContent = $derived(renderable?.mode === 'rich' ? renderable.content : '');

    // 문서 path → 인코딩된 URL (편집/역사 링크)
    const pageUrl = $derived.by(() => {
        const p = (data.wikiPage?.path || '').replace(/^\/+/, '').replace(/\/+$/, '');
        if (!p) return '';
        return '/' + p.split('/').map(encodeURIComponent).join('/');
    });

    // 본문 렌더 후 헤딩(h2~h4)에 TOC 와 동일한 slug id 주입
    let contentEl: HTMLDivElement | undefined = $state();
    $effect(() => {
        // renderable 변경 시 재실행
        void renderable;
        if (!contentEl) return;
        tick().then(() => {
            const seen = new Map<string, number>();
            contentEl?.querySelectorAll<HTMLElement>('h2, h3, h4').forEach((h) => {
                let slug = slugify(h.textContent || '');
                const n = seen.get(slug) ?? 0;
                seen.set(slug, n + 1);
                if (n > 0) slug = `${slug}-${n + 1}`;
                h.id = slug;
            });
        });
    });

    // 본문 안 깨진 이미지(외부 hotlink 차단 / 파일 삭제)를 우아하게 대체.
    // - Markdown 컴포넌트의 data-original 폴백이 실패한 후에도 처리
    // - 깨진 img → span.wiki-img-broken (이름/alt 표시 + 원본 링크)
    $effect(() => {
        void renderable;
        if (!contentEl) return;
        tick().then(() => {
            const imgs = contentEl?.querySelectorAll<HTMLImageElement>('img');
            imgs?.forEach((img) => {
                const fallback = () => {
                    if (img.dataset.brokenHandled) return;
                    img.dataset.brokenHandled = '1';
                    const span = document.createElement('span');
                    span.className = 'wiki-img-broken';
                    const label = img.alt?.trim() || img.title?.trim() || '이미지';
                    span.textContent = `🖼 ${label}`;
                    span.title = `원본 (불러올 수 없음): ${img.currentSrc || img.src}`;
                    img.replaceWith(span);
                };
                img.addEventListener('error', fallback);
                // SSR 이미지가 hydration 전 이미 실패한 경우
                if (img.complete && img.naturalWidth === 0) fallback();
            });
        });
    });
</script>

<svelte:head>
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
    <div class="wiki-special-page">
        {#if data.specialType === 'RecentChanges'}
            <h1>최근 변경</h1>
            <p class="text-gray-600">최근 변경된 문서 목록입니다.</p>
            <p class="mt-4 text-sm text-gray-500">이 기능은 준비 중입니다.</p>
        {:else if data.specialType === 'Random'}
            <h1>임의 문서</h1>
            <p class="text-gray-600">임의의 문서로 이동합니다.</p>
        {:else if data.specialType === 'AllPages'}
            <h1>모든 문서</h1>
            <p class="text-gray-600">위키앙의 모든 문서 목록입니다.</p>
        {:else}
            <h1>특수:{data.specialType}</h1>
            <p class="text-gray-600">이 특수 페이지는 아직 구현되지 않았습니다.</p>
        {/if}
    </div>
{:else if data.notFound}
    <div class="wiki-shell">
        <article class="wiki-main wiki-not-found">
            <Breadcrumbs path={data.requestedPath} />

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
                        href={`/Special:Search?q=${encodeURIComponent(data.requestedTitle)}`}
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
                    <a class="wiki-action" href={`/토론:${data.wikiPage.title}`}>
                        <MessageSquareIcon class="h-3.5 w-3.5" /> 토론
                    </a>
                </div>
            </header>

            <div class="wiki-content" bind:this={contentEl}>
                {#if renderable?.mode === 'rich'}
                    <Markdown content={renderable.content} />
                {:else if renderable?.mode === 'raw'}
                    <p class="wiki-raw-notice">
                        ⚠️ 이 문서는 아직 정규화된 본문이 없어 원본({renderable.type})을 그대로
                        표시합니다.
                    </p>
                    <pre class="wiki-raw">{renderable.content}</pre>
                {:else}
                    <p class="text-gray-500">이 문서는 아직 내용이 없습니다.</p>
                {/if}
            </div>

            <BacklinksPanel backlinks={data.backlinks || []} />

            <footer class="wiki-footer">
                마지막 수정: {new Date(data.wikiPage.updated_at).toLocaleString('ko-KR')}
            </footer>
        </article>

        {#if tocContent}
            <aside class="wiki-toc-rail">
                <Toc content={tocContent} />
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
    .wiki-raw-notice {
        margin-bottom: 0.75rem;
        border-radius: 0.375rem;
        background: #fffbeb;
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        color: #92400e;
    }
    .wiki-raw {
        white-space: pre-wrap;
        word-break: break-word;
        background: var(--muted, #f8f9fa);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 0.375rem;
        padding: 0.75rem;
        font-size: 0.85rem;
        overflow-x: auto;
    }
    .wiki-special-page h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 1rem;
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
