<script lang="ts">
    import { page } from '$app/stores';
    import { wikiHref, validateWikiPath } from '$lib/wiki/paths';
    import type { SpecialPageData } from '$lib/wiki/special-types';
    let { special }: { special: SpecialPageData } = $props();
    let newTitle = $state('');
    let message = $state('');
    const names: Record<string, string> = {
        RecentChanges: '최근 바뀜',
        AllPages: '모든 문서',
        Categories: '분류',
        Category: '분류 문서',
        Tags: '태그',
        Tag: '태그 문서',
        Search: '문서 검색',
        NewPage: '새 문서 만들기',
        Unknown: '없는 특수 페이지'
    };
    const result = $derived('result' in special ? special.result : null);
    function pagination(offset: number): string {
        const params = new URLSearchParams($page.url.searchParams);
        params.set('offset', String(offset));
        return $page.url.pathname + '?' + params;
    }
    function create(event: SubmitEvent) {
        event.preventDefault();
        const path = validateWikiPath(newTitle);
        if (!path) {
            message = '제목을 확인해주세요. 예약 경로와 ?, # 등의 문자는 사용할 수 없습니다.';
            return;
        }
        window.location.href = wikiHref(path) + '/edit';
    }
</script>

<section class="special">
    <h1>{names[special.type] || special.type}</h1>
    {#if special.type === 'Search'}
        <form action="/Special:Search" method="GET" class="search-form">
            <input
                name="q"
                aria-label="검색어"
                value={special.query}
                placeholder="제목이나 본문 검색"
                required
                maxlength="200"
            />
            <button>검색</button>
        </form>
        {#if !special.query}<p>로그인 없이 문서를 검색할 수 있습니다.</p>{/if}
    {:else if special.type === 'NewPage'}
        <p>
            먼저 같은 내용의 문서가 있는지 <a href="/Special:Search">검색</a>해주세요. 같은 제목이
            있으면 기존 문서를 편집합니다.
        </p>
        <form onsubmit={create} class="search-form">
            <input
                bind:value={newTitle}
                aria-label="새 문서 제목"
                placeholder="새 문서 제목"
                required
                maxlength="500"
            />
            <button>편집 시작</button>
        </form>
        {#if message}<p role="alert">{message}</p>{/if}
        <p><a href="/도움말">편집 도움말</a>에서 작성·미리보기·저장 방법을 확인하세요.</p>
    {:else if special.type === 'RecentChanges'}
        <p>
            최근에 수정된 공개 문서입니다. 문서의 역사에서 편집 내용과 이전 버전을 확인할 수
            있습니다.
        </p>
        <ul>
            {#each special.pages as item}<li>
                    <a href={wikiHref(item.path)}>{item.title}</a><small
                        >{new Date(item.updated_at).toLocaleString('ko-KR')}</small
                    ><a href={wikiHref(item.path) + '/history'}>역사</a>
                </li>{:else}<li>아직 편집된 문서가 없습니다.</li>{/each}
        </ul>
    {:else if special.type === 'Categories'}
        <ul>
            {#each special.categories as item}<li>
                    <a href={'/Special:Category/' + item.id}>{item.name}</a><small
                        >{item.page_count}개 문서</small
                    >
                </li>{:else}<li>등록된 분류가 없습니다.</li>{/each}
        </ul>
    {:else if special.type === 'Tags'}
        <ul>
            {#each special.tags as item}<li>
                    <a href={'/Special:Tag/' + item.id}>{item.title || item.tag}</a><small
                        >{item.page_count || 0}개 문서</small
                    >
                </li>{:else}<li>등록된 태그가 없습니다.</li>{/each}
        </ul>
    {:else if special.type === 'Category'}<p>{special.category?.name || '없는 분류'}</p>
    {:else if special.type === 'Tag'}<p>{special.tag?.title || special.tag?.tag || '없는 태그'}</p>
    {:else if special.type === 'Unknown'}<p>
            이 특수 페이지는 존재하지 않습니다. <a href="/Special:AllPages">모든 문서</a>에서
            찾아보세요.
        </p>
    {/if}
    {#if result}
        <p>총 {result.total}개 문서</p>
        <ul>
            {#each result.items as item (item.id)}<li class="result">
                    <a href={wikiHref(item.path)}>{item.title}</a><small>{item.path}</small
                    >{#if item.description}<p>{item.description}</p>{/if}
                </li>{:else}<li>조건에 맞는 문서가 없습니다.</li>{/each}
        </ul>
        <nav aria-label="결과 페이지">
            {#if result.offset > 0}<a href={pagination(Math.max(0, result.offset - result.limit))}
                    >← 이전</a
                >{/if}{#if result.hasMore}<a href={pagination(result.offset + result.limit)}
                    >다음 →</a
                >{/if}
        </nav>
    {/if}
</section>

<style>
    .special {
        max-width: 900px;
    }
    h1 {
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 1rem;
    }
    p {
        margin: 0.8rem 0;
    }
    a {
        color: var(--primary);
        text-decoration: underline;
    }
    ul {
        margin: 1rem 0;
    }
    li {
        display: flex;
        align-items: baseline;
        gap: 0.8rem;
        flex-wrap: wrap;
        padding: 0.8rem 0;
        border-bottom: 1px solid var(--border);
        overflow-wrap: anywhere;
    }
    small {
        color: var(--muted-foreground);
        font-size: 0.8rem;
    }
    .result {
        display: block;
    }
    .result small {
        display: block;
    }
    .search-form {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
    }
    input {
        width: 100%;
        min-width: 0;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 0.6rem;
        background: var(--background);
    }
    button {
        background: var(--primary);
        color: var(--primary-foreground);
        border-radius: 0.5rem;
        padding: 0.6rem 1rem;
        flex-shrink: 0;
    }
    nav {
        display: flex;
        gap: 2rem;
    }
</style>
