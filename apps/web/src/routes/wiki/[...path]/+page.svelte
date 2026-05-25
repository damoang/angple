<script lang="ts">
    /**
     * 수정안: wikiang.org /wiki/[...path] 본문 렌더러
     *
     * [기존 문제]
     *  - 손수 짠 renderContent() 가 content_type==='markdown' 만 marked 처리,
     *    나머지(html·wikitext·null)는 원문을 그대로 {@html} → 위키텍스트/마크다운이 글자로 노출.
     *  - content 가 비어있으면 content_raw(주로 MediaWiki 위키텍스트)를 같은 content_type 으로
     *    렌더 → marked 가 위키텍스트를 못 살려 깨짐.
     *  - prose 스타일이 h1 만 있어 h2/표/목록이 무스타일. sanitize 없음(XSS).
     *
     * [수정]
     *  - 검증된 코어 <Markdown> 컴포넌트 재사용 (marked + DOMPurify + prose 스타일 + 임베드).
     *    markdown/html content_type 이고 content 가 있으면 이걸로 렌더.
     *  - content 가 없고 content_raw 만 있는(미변환 위키텍스트 등) 경우: 깨진 marked 출력 대신
     *    안내 + 원문을 escape 된 <pre> 로 표시 (Svelte 텍스트 보간 = 자동 escape, {@html} 아님).
     *    → 정상 표시는 데이터 백필(위키텍스트→markdown)로 해결 (별도 작업).
     */
    import type { PageData } from './$types';
    import { Markdown } from '$lib/components/ui/markdown/index.js';

    const { data }: { data: PageData } = $props();

    type Renderable =
        | { mode: 'rich'; content: string }
        | { mode: 'raw'; content: string; type: string }
        | null;

    /** 페이지의 렌더 방식 결정 (순수 함수 — 테스트 용이) */
    function pickRenderable(page: {
        content: string | null;
        content_raw: string | null;
        content_type: string | null;
    } | null): Renderable {
        if (!page) return null;
        const ct = page.content_type;
        // 정규화된 본문(content)이 있고 markdown/html 이면 코어 렌더러로
        if (page.content && (ct === 'markdown' || ct === 'html')) {
            return { mode: 'rich', content: page.content };
        }
        // content 없음 → 원문(content_raw)만 존재 (미변환 위키텍스트 등): 깨진 변환 대신 원문 노출
        if (page.content_raw) {
            return { mode: 'raw', content: page.content_raw, type: ct || 'unknown' };
        }
        // content 는 있으나 content_type 이 wikitext 인 비정상 케이스도 raw 취급
        if (page.content) {
            return { mode: 'raw', content: page.content, type: ct || 'unknown' };
        }
        return null;
    }

    const renderable = $derived(pickRenderable(data.wikiPage));
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

        {#if renderable?.mode === 'rich'}
            <div class="wiki-content">
                <Markdown content={renderable.content} />
            </div>
        {:else if renderable?.mode === 'raw'}
            <div class="wiki-content">
                <p class="wiki-raw-notice">
                    ⚠️ 이 문서는 아직 정규화된 본문이 없어 원본({renderable.type})을 그대로 표시합니다.
                </p>
                <pre class="wiki-raw">{renderable.content}</pre>
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
        background: #f8f9fa;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
        font-size: 0.85rem;
        overflow-x: auto;
    }
</style>
