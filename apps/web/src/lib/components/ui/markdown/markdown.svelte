<script lang="ts">
    import { marked } from 'marked';
    import DOMPurify from 'dompurify';
    import { onMount } from 'svelte';
    import { applyFilter } from '$lib/hooks/registry';
    import { getHookVersion } from '$lib/hooks/hook-state.svelte';

    interface Props {
        content: string;
        class?: string;
        /** URL 자동 임베딩 활성화 (기본값: true) */
        enableEmbed?: boolean;
    }

    let { content, class: className = '', enableEmbed = true }: Props = $props();

    let renderedHtml = $state('');
    let isBrowser = $state(false);

    // marked 옵션 설정 (GFM 활성화)
    marked.setOptions({
        gfm: true,
        breaks: true
    });

    onMount(() => {
        isBrowser = true;
    });

    // 마크다운을 HTML로 변환하고 플러그인 필터 적용 후 sanitize
    $effect(() => {
        // hookVersion을 읽어서 hook 등록 시 $effect 재실행
        const _hv = getHookVersion();

        if (isBrowser && content) {
            const rawHtml = marked.parse(content) as string;

            applyFilter<string>('post_content', rawHtml).then((filtered) => {
                renderedHtml = DOMPurify.sanitize(filtered, {
                    ALLOWED_TAGS: [
                        'h1',
                        'h2',
                        'h3',
                        'h4',
                        'h5',
                        'h6',
                        'p',
                        'br',
                        'strong',
                        'em',
                        'u',
                        's',
                        'del',
                        'ul',
                        'ol',
                        'li',
                        'blockquote',
                        'code',
                        'pre',
                        'a',
                        'img',
                        'table',
                        'thead',
                        'tbody',
                        'tr',
                        'th',
                        'td',
                        'hr',
                        'div',
                        'iframe',
                        'video',
                        'audio',
                        'source',
                        'span'
                    ],
                    ALLOWED_ATTR: [
                        'href',
                        'src',
                        'alt',
                        'title',
                        'class',
                        'target',
                        'rel',
                        'width',
                        'loading',
                        'height',
                        'style',
                        'data-platform',
                        'data-bluesky-uri',
                        'data-bluesky-cid',
                        'data-embed-height',
                        'frameborder',
                        'allow',
                        'allowfullscreen',
                        'allowtransparency',
                        'scrolling',
                        'referrerpolicy',
                        'type',
                        'controls',
                        'autoplay',
                        'muted',
                        'loop',
                        'playsinline'
                    ]
                });
            });
        }
    });
</script>

{#if isBrowser}
    <div class="prose prose-neutral dark:prose-invert max-w-none {className}">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html renderedHtml}
    </div>
{:else}
    <!-- SSR fallback: 원본 텍스트 표시 -->
    <div class="whitespace-pre-wrap {className}">
        {content}
    </div>
{/if}

<style>
    /* Tailwind Typography 플러그인이 없을 경우를 위한 기본 스타일 */
    .prose :global(h1) {
        font-size: 2rem;
        font-weight: 700;
        margin-top: 1.5rem;
        margin-bottom: 1rem;
    }

    .prose :global(h2) {
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 1.25rem;
        margin-bottom: 0.75rem;
    }

    .prose :global(h3) {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }

    .prose :global(p) {
        margin-top: 0.75rem;
        margin-bottom: 0.75rem;
        line-height: 1.75;
    }

    .prose :global(ul),
    .prose :global(ol) {
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        padding-left: 1.5rem;
    }

    .prose :global(ul) {
        list-style-type: disc;
    }

    .prose :global(ol) {
        list-style-type: decimal;
    }

    .prose :global(li) {
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
    }

    .prose :global(blockquote) {
        border-left: 4px solid var(--border);
        padding-left: 1rem;
        margin: 1rem 0;
        color: var(--muted-foreground);
        font-style: italic;
    }

    .prose :global(code) {
        background-color: var(--muted);
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-family: ui-monospace, monospace;
    }

    .prose :global(pre) {
        background-color: var(--muted);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 1rem 0;
    }

    .prose :global(pre code) {
        background-color: transparent;
        padding: 0;
    }

    .prose :global(a) {
        color: var(--primary);
        text-decoration: underline;
    }

    .prose :global(a:hover) {
        text-decoration: none;
    }

    .prose :global(img) {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
    }

    .prose :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
    }

    .prose :global(th),
    .prose :global(td) {
        border: 1px solid var(--border);
        padding: 0.5rem;
        text-align: left;
    }

    .prose :global(th) {
        background-color: var(--muted);
        font-weight: 600;
    }

    .prose :global(hr) {
        border: none;
        border-top: 1px solid var(--border);
        margin: 1.5rem 0;
    }

    .prose :global(strong) {
        font-weight: 700;
    }

    .prose :global(em) {
        font-style: italic;
    }

    /* 임베드 컨테이너 스타일 */
    .prose :global(.embed-container) {
        position: relative;
        width: 100%;
        max-width: var(--max-width, 100%);
        margin: 1rem 0;
    }

    .prose :global(.embed-container)::before {
        content: '';
        display: block;
        padding-bottom: var(--aspect-ratio, 56.25%);
    }

    .prose :global(.embed-container iframe),
    .prose :global(.embed-container video),
    .prose :global(.embed-container audio) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 0;
        border-radius: 0.5rem;
    }

    /* 세로 영상 (Shorts, Reels, TikTok) */
    .prose :global(.embed-container[data-platform='youtube-shorts']),
    .prose :global(.embed-container[data-platform='instagram-reel']),
    .prose :global(.embed-container[data-platform='tiktok']) {
        margin-left: auto;
        margin-right: auto;
    }

    /* Twitter 가변 높이 */
    .prose :global(.embed-container[data-platform='twitter']) {
        min-height: 250px;
    }

    .prose :global(.embed-container[data-platform='twitter'])::before {
        display: none;
    }

    .prose :global(.embed-container[data-platform='twitter'] iframe) {
        position: relative;
        min-height: 250px;
        height: auto;
    }

    /* 직접 비디오 파일 ({video:} 패턴) */
    .prose :global(.na-video-direct) {
        margin: 1rem 0;
    }

    .prose :global(.na-video-direct video) {
        max-width: 100%;
        border-radius: 0.5rem;
    }
</style>
