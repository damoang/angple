<script lang="ts">
    import { marked } from 'marked';
    import DOMPurify from 'isomorphic-dompurify';
    import { onMount, tick } from 'svelte';
    import { applyFilter } from '$lib/hooks/registry';
    import { getHookVersion } from '$lib/hooks/hook-state.svelte';
    import { browser } from '$app/environment';
    import { highlightAllCodeBlocks } from '$lib/utils/code-highlight';
    import { transformEscapedMedia } from '$lib/utils/content-transform';

    interface Props {
        content: string;
        class?: string;
        /** URL 자동 임베딩 활성화 (기본값: true) */
        enableEmbed?: boolean;
        /** 링크 텍스트/URL 불일치 경고 표시 (기본값: true) */
        showLinkWarning?: boolean;
    }

    let {
        content,
        class: className = '',
        enableEmbed = true,
        showLinkWarning = true
    }: Props = $props();

    /**
     * URL에서 도메인 추출 (프로토콜, www, 경로 제거)
     */
    function extractDomain(url: string): string | null {
        try {
            if (url.startsWith('/') || url.startsWith('#')) {
                return null;
            }
            let normalizedUrl = url;
            if (!url.match(/^https?:\/\//i)) {
                normalizedUrl = 'https://' + url;
            }
            const parsed = new URL(normalizedUrl);
            return parsed.hostname.replace(/^www\./i, '').toLowerCase();
        } catch {
            return null;
        }
    }

    /**
     * 텍스트가 URL 형식인지 확인
     */
    function isUrlLikeText(text: string): boolean {
        const trimmed = text.trim();
        return /^(https?:\/\/|www\.)/i.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed);
    }

    /**
     * 링크 텍스트와 href의 도메인이 일치하는지 확인
     */
    function isLinkDomainMatch(href: string, text: string): boolean {
        const trimmedText = text.trim();
        if (!isUrlLikeText(trimmedText)) {
            return true;
        }
        const hrefDomain = extractDomain(href);
        const textDomain = extractDomain(trimmedText);
        if (!hrefDomain || !textDomain) {
            return true;
        }
        const hrefRoot = hrefDomain.split('.').slice(-2).join('.');
        const textRoot = textDomain.split('.').slice(-2).join('.');
        return hrefRoot === textRoot;
    }

    /**
     * HTML 내 링크에 도메인 불일치 경고 추가
     */
    function addLinkMismatchWarnings(html: string): string {
        if (!showLinkWarning || !browser) return html;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href]');

        links.forEach((link) => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent || '';

            if (!isLinkDomainMatch(href, text)) {
                const hrefDomain = extractDomain(href);
                const warning = doc.createElement('span');
                warning.className = 'link-mismatch-warning';
                warning.title = `실제 링크: ${hrefDomain || href}`;
                warning.textContent = ' \u26A0\uFE0F';
                link.appendChild(warning);
                link.classList.add('has-link-warning');
            }
        });

        return doc.body.innerHTML;
    }

    // DOMPurify 설정
    const PURIFY_CONFIG = {
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
            'figure',
            'figcaption',
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
            'data-tweet-id',
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
            'playsinline',
            'preload'
        ]
    };

    // marked 옵션 설정 (GFM 활성화)
    marked.setOptions({
        gfm: true,
        breaks: true
    });

    // SSR용 기본 HTML (플러그인 필터 없이, 이스케이프된 미디어 태그는 복원)
    function getInitialHtml(content: string): string {
        if (!content) return '';
        let rawHtml = marked.parse(content) as string;
        rawHtml = transformEscapedMedia(rawHtml);
        return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
    }

    // 초기 렌더링 (SSR + 클라이언트 초기값)
    let renderedHtml = $state(getInitialHtml(content));
    let proseEl: HTMLDivElement;

    onMount(() => {
        // Twitter iframe postMessage resize 수신
        function handleTwitterResize(event: MessageEvent) {
            if (event.origin !== 'https://platform.twitter.com') return;
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                const resizeData = data?.['twttr.private.resize'];
                if (resizeData && Array.isArray(resizeData)) {
                    const height = resizeData[0]?.height;
                    if (height && typeof height === 'number') {
                        const iframes =
                            document.querySelectorAll<HTMLIFrameElement>('iframe[data-tweet-id]');
                        for (const iframe of iframes) {
                            if (iframe.contentWindow === event.source) {
                                iframe.style.height = `${height}px`;
                                break;
                            }
                        }
                    }
                }
            } catch {
                // 무시
            }
        }

        window.addEventListener('message', handleTwitterResize);
        return () => window.removeEventListener('message', handleTwitterResize);
    });

    // 클라이언트에서 플러그인 필터 적용
    $effect(() => {
        // hookVersion을 읽어서 hook 등록 시 $effect 재실행
        const _hv = getHookVersion();

        if (browser && content) {
            const rawHtml = marked.parse(content) as string;

            applyFilter<string>('post_content', rawHtml).then((filtered) => {
                let sanitized = DOMPurify.sanitize(filtered, PURIFY_CONFIG);
                // 링크 텍스트/URL 불일치 경고 추가
                sanitized = addLinkMismatchWarnings(sanitized);
                renderedHtml = sanitized;
            });
        }
    });

    // 코드 블록 구문 하이라이팅 (렌더링 완료 후 적용)
    $effect(() => {
        // renderedHtml 변경 감지
        void renderedHtml;
        if (browser && proseEl) {
            tick().then(() => highlightAllCodeBlocks(proseEl));
        }
    });
</script>

<div
    bind:this={proseEl}
    class="prose prose-neutral dark:prose-invert max-w-none text-lg {className}"
    style="overflow-wrap: break-word; word-wrap: break-word; overflow-x: hidden;"
>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html renderedHtml}
</div>

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
        font-size: 1.125rem;
        line-height: 1.8;
    }

    /* 빈 <p></p> 및 <p><br></p> 태그도 줄바꿈으로 표시 (에디터 엔터키 반영) */
    .prose :global(p:empty),
    .prose :global(p:has(> br:only-child)) {
        min-height: 1.8em;
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
        font-synthesis: style;
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
        overflow-wrap: break-word;
        word-break: break-all;
    }

    .prose :global(a:hover) {
        text-decoration: none;
    }

    /* 링크 텍스트/URL 불일치 경고 */
    .prose :global(a.has-link-warning) {
        position: relative;
    }

    .prose :global(.link-mismatch-warning) {
        display: inline-flex;
        align-items: center;
        margin-left: 2px;
        font-size: 0.875em;
        cursor: help;
        vertical-align: middle;
    }

    .prose :global(img) {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
    }

    .prose :global(table) {
        display: block;
        width: 100%;
        overflow-x: auto;
        border-collapse: collapse;
        margin: 1rem 0;
    }

    .prose :global(th),
    .prose :global(td) {
        border: 1px solid var(--border);
        padding: 0.5rem;
        text-align: left;
    }

    /* 줄번호 테이블은 일반 테이블 스타일 제외 */
    .prose :global(.hljs-ln) {
        display: table;
        border-collapse: collapse;
        margin: 0;
    }

    .prose :global(.hljs-ln td) {
        border: none;
        padding: 0;
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
        font-synthesis: style;
    }

    /* 임베드 컨테이너 스타일 */
    /* 모든 iframe/video가 컨테이너를 넘지 않도록 (인라인 width/height 속성 오버라이드) */
    .prose :global(iframe),
    .prose :global(video) {
        max-width: 100% !important;
        height: auto !important;
    }

    /* YouTube iframe은 16:9 비율 유지 */
    .prose :global(iframe[src*='youtube']),
    .prose :global(iframe[src*='youtu.be']) {
        aspect-ratio: 16 / 9;
    }

    .prose :global(.embed-container) {
        position: relative;
        width: 100%;
        max-width: var(--max-width, 100%);
        margin: 1rem 0;
        overflow: hidden;
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
