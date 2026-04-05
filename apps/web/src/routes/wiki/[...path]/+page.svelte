<script lang="ts">
    import type { PageData } from './$types';
    import Toc from '$lib/components/wiki/toc.svelte';

    const { data }: { data: PageData } = $props();

    function formatDate(date: Date | string): string {
        return new Date(date).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatRelativeTime(date: Date | string): string {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return formatDate(date);
    }
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

{#if data.isSpecialPage && data.specialData}
    <div class="wiki-special-page">
        {#if data.specialData.type === 'RecentChanges'}
            <h1>최근 변경</h1>
            <p class="page-description">최근 변경된 문서 목록입니다.</p>

            {#if data.specialData.pages.length > 0}
                <ul class="page-list">
                    {#each data.specialData.pages as page}
                        <li>
                            <a href="/wiki{page.path}" class="page-link">{page.title}</a>
                            <span class="page-time">{formatRelativeTime(page.updated_at)}</span>
                            {#if page.description}
                                <p class="page-desc">{page.description}</p>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty-message">변경된 문서가 없습니다.</p>
            {/if}

        {:else if data.specialData.type === 'AllPages'}
            <h1>모든 문서</h1>
            <p class="page-description">
                위키앙의 모든 문서 목록입니다.
                (총 {data.specialData.result.total}개)
            </p>

            <div class="sort-options">
                <a href="?sort=title" class:active={data.specialData.sort === 'title'}>제목순</a>
                <a href="?sort=updated" class:active={data.specialData.sort === 'updated'}>최근 수정순</a>
            </div>

            {#if data.specialData.result.items.length > 0}
                <ul class="page-list">
                    {#each data.specialData.result.items as page}
                        <li>
                            <a href="/wiki{page.path}" class="page-link">{page.title}</a>
                            <span class="page-time">{formatRelativeTime(page.updated_at)}</span>
                            {#if page.description}
                                <p class="page-desc">{page.description}</p>
                            {/if}
                        </li>
                    {/each}
                </ul>

                {#if data.specialData.result.hasMore}
                    <div class="pagination">
                        <a href="?offset={data.specialData.result.offset + data.specialData.result.limit}&sort={data.specialData.sort}">
                            다음 페이지 &rarr;
                        </a>
                    </div>
                {/if}
                {#if data.specialData.result.offset > 0}
                    <div class="pagination">
                        <a href="?offset={Math.max(0, data.specialData.result.offset - data.specialData.result.limit)}&sort={data.specialData.sort}">
                            &larr; 이전 페이지
                        </a>
                    </div>
                {/if}
            {:else}
                <p class="empty-message">문서가 없습니다.</p>
            {/if}

        {:else if data.specialData.type === 'Categories'}
            <h1>분류 목록</h1>
            <p class="page-description">위키앙의 모든 분류입니다.</p>

            {#if data.specialData.categories.length > 0}
                <ul class="category-list">
                    {#each data.specialData.categories as category}
                        <li>
                            <a href="/wiki/Special:Category/{category.id}" class="category-link">
                                {category.name}
                            </a>
                            <span class="count">({category.page_count})</span>
                            {#if category.description}
                                <p class="category-desc">{category.description}</p>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty-message">분류가 없습니다.</p>
            {/if}

        {:else if data.specialData.type === 'Category'}
            <h1>분류:{data.specialData.category?.name || `ID ${data.specialData.categoryId}`}</h1>
            {#if data.specialData.category?.description}
                <p class="page-description">{data.specialData.category.description}</p>
            {/if}
            <p class="page-description">이 분류에 속한 문서 {data.specialData.result.total}개</p>

            {#if data.specialData.result.items.length > 0}
                <ul class="page-list">
                    {#each data.specialData.result.items as page}
                        <li>
                            <a href="/wiki{page.path}" class="page-link">{page.title}</a>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty-message">이 분류에 속한 문서가 없습니다.</p>
            {/if}

        {:else if data.specialData.type === 'Tags'}
            <h1>태그 목록</h1>
            <p class="page-description">위키앙의 모든 태그입니다.</p>

            {#if data.specialData.tags.length > 0}
                <div class="tag-cloud">
                    {#each data.specialData.tags as tag}
                        <a href="/wiki/Special:Tag/{tag.id}" class="tag">
                            #{tag.tag}
                            <span class="count">({tag.page_count})</span>
                        </a>
                    {/each}
                </div>
            {:else}
                <p class="empty-message">태그가 없습니다.</p>
            {/if}

        {:else if data.specialData.type === 'Tag'}
            <h1>태그: #{data.specialData.tag?.tag || `ID ${data.specialData.tagId}`}</h1>
            <p class="page-description">이 태그가 붙은 문서 {data.specialData.result.total}개</p>

            {#if data.specialData.result.items.length > 0}
                <ul class="page-list">
                    {#each data.specialData.result.items as page}
                        <li>
                            <a href="/wiki{page.path}" class="page-link">{page.title}</a>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty-message">이 태그가 붙은 문서가 없습니다.</p>
            {/if}

        {:else if data.specialData.type === 'Search'}
            <h1>검색 결과</h1>

            <form method="get" action="/wiki/Special:Search" class="search-form">
                <input
                    type="text"
                    name="q"
                    value={data.specialData.query}
                    placeholder="검색어를 입력하세요"
                    class="search-input"
                />
                <button type="submit" class="search-button">검색</button>
            </form>

            {#if data.specialData.query}
                <p class="page-description">
                    "{data.specialData.query}" 검색 결과: {data.specialData.result.total}건
                </p>

                {#if data.specialData.result.items.length > 0}
                    <ul class="search-results">
                        {#each data.specialData.result.items as result}
                            <li>
                                <a href="/wiki{result.path}" class="page-link">{result.title}</a>
                                <span class="page-time">{formatRelativeTime(result.updated_at)}</span>
                                {#if result.description}
                                    <p class="page-desc">{result.description}</p>
                                {:else if result.snippet}
                                    <p class="page-desc snippet">{result.snippet}...</p>
                                {/if}
                            </li>
                        {/each}
                    </ul>

                    {#if data.specialData.result.hasMore}
                        <div class="pagination">
                            <a href="?q={encodeURIComponent(data.specialData.query)}&offset={data.specialData.result.offset + data.specialData.result.limit}">
                                더 보기 &rarr;
                            </a>
                        </div>
                    {/if}
                {:else}
                    <p class="empty-message">검색 결과가 없습니다.</p>
                {/if}
            {:else}
                <p class="empty-message">검색어를 입력하세요.</p>
            {/if}

        {:else}
            <h1>특수:{data.specialData.name}</h1>
            <p class="page-description">이 특수 페이지는 아직 구현되지 않았습니다.</p>
        {/if}
    </div>
{:else if data.wikiPage}
    <div class="wiki-article-wrapper flex gap-8">
        <article class="wiki-article min-w-0 flex-1">
            <header class="article-header">
                <h1>{data.wikiPage.title}</h1>
                <div class="article-actions">
                    <a href="/wiki{data.wikiPage.path}/edit" class="action-link">편집</a>
                    <a href="/wiki{data.wikiPage.path}/history" class="action-link">이력</a>
                </div>
            </header>

            {#if data.wikiPage.content}
                <div class="wiki-content">
                    {@html data.wikiPage.content}
                </div>
            {:else if data.wikiPage.content_raw}
                <div class="wiki-content">
                    <pre class="whitespace-pre-wrap">{data.wikiPage.content_raw}</pre>
                </div>
            {:else}
                <p class="empty-message">이 문서는 아직 내용이 없습니다.</p>
            {/if}

            <footer class="article-footer">
                <p>마지막 수정: {formatDate(data.wikiPage.updated_at)}</p>
            </footer>
        </article>

        <!-- TOC (xl 이상에서만 표시) -->
        <Toc contentSelector=".wiki-content" />
    </div>
{/if}

<style>
    /* 공통 스타일 */
    .wiki-special-page h1,
    .wiki-article h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.5rem;
    }

    .page-description {
        color: var(--muted-foreground);
        margin-bottom: 1.5rem;
    }

    .empty-message {
        color: var(--muted-foreground);
        font-style: italic;
        padding: 2rem;
        text-align: center;
    }

    /* 페이지 목록 */
    .page-list, .category-list, .search-results {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .page-list li, .category-list li, .search-results li {
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--border);
    }

    .page-link, .category-link {
        color: var(--primary);
        text-decoration: none;
        font-weight: 500;
    }

    .page-link:hover, .category-link:hover {
        text-decoration: underline;
    }

    .page-time {
        color: var(--muted-foreground);
        font-size: 0.875rem;
        margin-left: 0.5rem;
    }

    .page-desc {
        color: var(--muted-foreground);
        font-size: 0.875rem;
        margin: 0.25rem 0 0 0;
    }

    .snippet {
        font-style: italic;
    }

    .count {
        color: var(--muted-foreground);
        font-size: 0.875rem;
    }

    /* 정렬 옵션 */
    .sort-options {
        margin-bottom: 1rem;
        display: flex;
        gap: 1rem;
    }

    .sort-options a {
        color: var(--muted-foreground);
        text-decoration: none;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .sort-options a.active {
        background-color: var(--primary);
        color: var(--primary-foreground);
    }

    /* 태그 클라우드 */
    .tag-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .tag {
        display: inline-block;
        padding: 0.5rem 0.75rem;
        background-color: var(--muted);
        border-radius: 0.375rem;
        color: var(--foreground);
        text-decoration: none;
        font-size: 0.875rem;
    }

    .tag:hover {
        background-color: var(--accent);
    }

    /* 검색 폼 */
    .search-form {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
    }

    .search-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        font-size: 1rem;
        background-color: var(--background);
        color: var(--foreground);
    }

    .search-input:focus {
        outline: none;
        border-color: var(--primary);
    }

    .search-button {
        padding: 0.5rem 1rem;
        background-color: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
    }

    .search-button:hover {
        opacity: 0.9;
    }

    /* 페이지네이션 */
    .pagination {
        margin-top: 1.5rem;
        text-align: center;
    }

    .pagination a {
        color: var(--primary);
        text-decoration: none;
    }

    /* 문서 페이지 */
    .article-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .article-actions {
        display: flex;
        gap: 0.5rem;
    }

    .action-link {
        color: var(--muted-foreground);
        text-decoration: none;
        font-size: 0.875rem;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--border);
        border-radius: 0.25rem;
    }

    .action-link:hover {
        background-color: var(--muted);
    }

    .wiki-content {
        line-height: 1.75;
    }

    .article-footer {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
        color: var(--muted-foreground);
        font-size: 0.875rem;
    }
</style>
