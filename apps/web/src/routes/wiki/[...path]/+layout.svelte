<script lang="ts">
    import '$lib/wiki/skins.css';
    import {
        WIKI_THEME_VERSION,
        WIKI_SKIN_COOKIE,
        WIKI_SKINS,
        parseWikiSkin,
        WIKI_TEXT_COOKIE,
        parseWikiTextSize,
        type WikiSkin,
        type WikiTextSize
    } from '$lib/wiki/skins';
    import WikiHeader from '$lib/components/wiki/wiki-header.svelte';
    import PageTree from '$lib/components/wiki/page-tree.svelte';
    import { page } from '$app/stores';
    import { decodeWikiPath } from '$lib/wiki/paths';
    let { children, data } = $props();
    let selectedSkin = $state<WikiSkin | null>(null);
    const skin = $derived(selectedSkin ?? data.wikiSkin);
    let selectedText = $state<WikiTextSize | null>(null);
    const textSize = $derived(selectedText ?? data.wikiTextSize);
    function changeTextSize(next: WikiTextSize) {
        selectedText = next;
        document.cookie = `${WIKI_TEXT_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax${location.protocol === 'https:' ? ';Secure' : ''}`;
    }
    function changeSkin(next: WikiSkin) {
        selectedSkin = next;
        document.cookie = `${WIKI_SKIN_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax${location.protocol === 'https:' ? ';Secure' : ''}`;
    }
    const currentPath = $derived(decodeWikiPath($page.url.pathname));
</script>

<div
    class="wiki-layout"
    data-theme-version={WIKI_THEME_VERSION}
    data-wiki-skin={skin}
    data-wiki-text={textSize}
>
    <WikiHeader {skin} onSkinChange={changeSkin} />
    <div class="wiki-body">
        <aside class="wiki-nav" aria-label="둘러보기">
            <div class="nav-label">둘러보기</div>
            <nav class="explore">
                <a href="/대문">대문</a><a href="/Special:AllPages">모든 문서</a>
                <a href="/Special:Categories">주제별 분류</a><a href="/Special:Random"
                    >임의의 문서</a
                >
                <a href="/Special:RecentChanges">최근 바뀜</a>
            </nav>
            <details class="document-index">
                <summary>문서 찾아보기</summary>
                <PageTree nodes={data.pageTree ?? []} {currentPath} />
            </details>
            <div class="contribution-note">
                <strong>작은 편집도 큰 도움이 됩니다</strong>
                <p>아는 내용을 보태고,<br />출처를 함께 남겨주세요.</p>
                <a href="/Special:NewPage">새 문서 쓰기 →</a>
            </div>
            <nav class="community">
                <a href="/도움말">도움말</a>
            </nav>
        </aside>
        <details class="mobile-explore">
            <summary>문서 둘러보기</summary>
            <nav>
                <a href="/Special:AllPages">모든 문서</a><a href="/Special:Categories">분류</a><a
                    href="/Special:Random">임의의 문서</a
                ><a href="/도움말">도움말</a>
            </nav>
            <PageTree nodes={data.pageTree ?? []} {currentPath} />
        </details>
        <details class="wiki-appearance" open>
            <summary>보기 설정</summary>
            <div class="appearance-controls">
                <label
                    >테마<select
                        aria-label="보기 설정 테마"
                        value={skin}
                        onchange={(event) => changeSkin(parseWikiSkin(event.currentTarget.value))}
                        >{#each WIKI_SKINS as item}<option value={item.value}>{item.label}</option
                            >{/each}</select
                    ></label
                >
                <label
                    >글자 크기<select
                        aria-label="본문 글자 크기"
                        value={textSize}
                        onchange={(event) =>
                            changeTextSize(parseWikiTextSize(event.currentTarget.value))}
                        ><option value="standard">표준</option><option value="large">크게</option
                        ></select
                    ></label
                >
                <p>화면 색상은 상단의 해·달 버튼으로 바꿀 수 있습니다.</p>
            </div>
        </details>
        <main id="wiki-main" class="wiki-main-col" tabindex="-1">{@render children()}</main>
    </div>
    <footer class="wiki-bottom">
        <div>
            <strong>위키앙</strong><span>함께 읽고 고치는 지식사전</span>
            <p class="operator">운영: WIKIANG LLC</p>
        </div>
        <nav aria-label="사이트 안내">
            <a href="/위키앙:이용_규칙">이용 규칙</a><a href="/위키앙:저작권">저작권</a><a
                href="/도움말">도움말</a
            >
        </nav>
    </footer>
</div>

<style>
    .wiki-appearance {
        display: none;
    }
    .appearance-controls {
        display: grid;
        gap: 1rem;
    }
    .appearance-controls label {
        display: grid;
        gap: 0.4rem;
        font-size: 0.78rem;
        color: var(--muted-foreground);
    }
    .appearance-controls select {
        width: 100%;
        padding: 0.5rem;
        background: var(--background);
        border: 1px solid var(--border);
        color: var(--foreground);
        border-radius: 3px;
    }
    .appearance-controls p {
        font-size: 0.73rem;
        color: var(--muted-foreground);
        line-height: 1.6;
    }
    .wiki-layout {
        --primary: var(--wiki-skin-accent, #315f9d);
        --primary-foreground: #fff;
        --ring: var(--wiki-skin-accent, #315f9d);
        min-height: 100vh;
        background: #f7f8fa;
        color: var(--foreground);
    }
    :global(.dark) .wiki-layout,
    :global(.amoled) .wiki-layout {
        --primary: var(--wiki-skin-dark-accent, #91b9ef);
        --primary-foreground: #152339;
        --ring: var(--wiki-skin-dark-accent, #91b9ef);
        background: #14191f;
    }
    .wiki-layout :global(a:focus-visible),
    .wiki-layout :global(button:focus-visible),
    .wiki-layout :global(summary:focus-visible) {
        outline: 2px solid var(--primary);
        outline-offset: 4px;
        border-radius: 2px;
    }
    .wiki-body {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        max-width: 1480px;
        margin: auto;
        gap: 2rem;
        padding: 2rem;
        align-items: start;
        min-height: 70vh;
    }
    .wiki-nav {
        position: sticky;
        top: 1.5rem;
        max-height: calc(100vh - 3rem);
        overflow-y: auto;
        padding: 0.6rem 0.5rem 1rem 0;
        font-size: 0.83rem;
    }
    .nav-label {
        font-size: 0.73rem;
        color: var(--muted-foreground);
        letter-spacing: 0.08em;
        margin-bottom: 0.6rem;
    }
    .explore,
    .community {
        display: grid;
        gap: 0.2rem;
    }
    .explore a,
    .community a {
        padding: 0.45rem 0;
    }
    .explore a:hover,
    .community a:hover {
        color: var(--primary);
    }
    .document-index {
        border-top: 1px solid var(--border);
        margin-top: 1rem;
        padding-top: 1rem;
    }
    summary {
        cursor: pointer;
        font-weight: 600;
        padding: 0.25rem 0 0.75rem;
    }
    .contribution-note {
        margin-top: 1.6rem;
        padding: 1rem 0;
        border-top: 1px solid var(--border);
        line-height: 1.7;
    }
    .contribution-note strong {
        font-size: 0.78rem;
    }
    .contribution-note p {
        color: var(--muted-foreground);
        margin: 0.5rem 0;
        font-size: 0.77rem;
    }
    .contribution-note a {
        color: var(--primary);
        font-weight: 600;
    }
    .community {
        font-size: 0.77rem;
        color: var(--muted-foreground);
    }
    .wiki-main-col {
        min-width: 0;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2rem 2.4rem;
        min-height: 600px;
    }
    .mobile-explore {
        display: none;
    }
    .wiki-bottom {
        max-width: 1480px;
        margin: auto;
        border-top: 1px solid var(--border);
        padding: 1.75rem 2rem 2.5rem;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        color: var(--muted-foreground);
        font-size: 0.78rem;
    }
    .operator {
        margin-top: 0.5rem;
        font-size: 0.72rem;
    }
    .wiki-bottom strong {
        color: var(--foreground);
        margin-right: 0.9rem;
    }
    .wiki-bottom nav {
        display: flex;
        gap: 1rem;
    }
    @media (max-width: 1100px) {
        .wiki-body {
            gap: 1.25rem;
            padding: 1.5rem;
            grid-template-columns: 155px minmax(0, 1fr);
        }
        .wiki-main-col {
            padding: 1.5rem;
        }
    }
    @media (max-width: 900px) {
        .wiki-nav {
            display: none;
        }
        .wiki-body {
            display: block;
            padding: 1rem;
        }
        .mobile-explore {
            display: block;
            margin: 0 0 1rem;
            padding: 0.6rem 0.85rem;
            border: 1px solid var(--border);
            background: var(--background);
            border-radius: 4px;
            font-size: 0.82rem;
        }
        .mobile-explore summary {
            padding: 0.2rem 0;
        }
        .mobile-explore nav {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            padding: 0.8rem 0;
            color: var(--primary);
        }
        .mobile-explore :global(.wiki-tree) {
            max-height: 300px;
            overflow-y: auto;
        }
    }
    @media (max-width: 500px) {
        .wiki-body {
            padding: 0.8rem;
        }
        .wiki-main-col {
            padding: 1.15rem 1rem;
        }
        .wiki-bottom {
            flex-direction: column;
            padding: 1.5rem;
        }
    }
</style>
