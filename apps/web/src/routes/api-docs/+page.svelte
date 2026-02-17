<script lang="ts">
    /**
     * 공개 API 문서 페이지
     *
     * Scalar를 사용한 OpenAPI 3.0 인터랙티브 문서.
     * /openapi.yaml 정적 파일을 기반으로 렌더링합니다.
     */

    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    let container: HTMLDivElement;

    onMount(() => {
        if (!browser) return;

        // Scalar API Reference CDN 로드
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/style.min.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src =
            'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js';
        script.onload = () => {
            // @ts-ignore - Scalar global
            if (window.Scalar) {
                // @ts-ignore
                window.Scalar.createApiReference(container, {
                    url: '/openapi.yaml',
                    theme: 'default',
                    layout: 'modern',
                    hideModels: false,
                    hideDownloadButton: false,
                    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches
                });
            }
        };
        document.head.appendChild(script);

        return () => {
            link.remove();
            script.remove();
        };
    });
</script>

<svelte:head>
    <title>API 문서 - Angple</title>
    <meta name="description" content="Angple 커뮤니티 플랫폼 REST API 문서" />
</svelte:head>

<div bind:this={container} class="min-h-screen"></div>
