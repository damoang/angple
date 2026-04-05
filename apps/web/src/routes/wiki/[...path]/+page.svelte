<script lang="ts">
    import type { PageData } from './$types';

    const { data }: { data: PageData } = $props();
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
            <p class="mt-4 text-sm text-gray-500">이 기능은 준비 중입니다.</p>
        {:else if data.specialType === 'AllPages'}
            <h1>모든 문서</h1>
            <p class="text-gray-600">위키앙의 모든 문서 목록입니다.</p>
            <p class="mt-4 text-sm text-gray-500">이 기능은 준비 중입니다.</p>
        {:else}
            <h1>특수:{data.specialType}</h1>
            <p class="text-gray-600">이 특수 페이지는 아직 구현되지 않았습니다.</p>
        {/if}
    </div>
{:else if data.wikiPage}
    <article class="wiki-article">
        <h1>{data.wikiPage.title}</h1>

        {#if data.wikiPage.content}
            <div class="wiki-content">
                {@html data.wikiPage.content}
            </div>
        {:else if data.wikiPage.content_raw}
            <div class="wiki-content">
                <pre class="whitespace-pre-wrap">{data.wikiPage.content_raw}</pre>
            </div>
        {:else}
            <p class="text-gray-500">이 문서는 아직 내용이 없습니다.</p>
        {/if}

        <footer class="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-500">
            <p>마지막 수정: {new Date(data.wikiPage.updated_at).toLocaleString('ko-KR')}</p>
        </footer>
    </article>
{/if}

<style>
    .wiki-article h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 0.5rem;
    }

    .wiki-special-page h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 1rem;
    }

    .wiki-content {
        line-height: 1.75;
    }
</style>
