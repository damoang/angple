<script lang="ts">
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    interface Props {
        nickname: string;
        userId: string;
        clientIp: string;
        pageTitle: string;
        redirectUrl?: string;
    }

    let { nickname, userId, clientIp, pageTitle, redirectUrl = '/truthroom' }: Props = $props();

    // 랜덤 ID (DevTools에서 선택자 예측 방지)
    const wmId = `wm_${Math.random().toString(36).slice(2, 10)}`;

    // 워터마크 텍스트
    const now = new Date();
    const timestamp = `${String(now.getFullYear()).slice(2)}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const watermarkUnit = `\t@${nickname}(${userId}) ${clientIp}\t${timestamp}\t${pageTitle}`;
    const repeatedText = (watermarkUnit + ' ').repeat(200);

    onMount(() => {
        // 변조 감지: 1초마다 DOM 검증
        const interval = setInterval(() => {
            const el = document.getElementById(wmId);
            if (!el) {
                goto(redirectUrl, { replaceState: true });
                return;
            }
            const paragraphs = el.querySelectorAll('p');
            const currentText = Array.from(paragraphs)
                .map((p) => p.textContent)
                .join('');
            const expectedText = repeatedText.repeat(10);
            if (currentText !== expectedText) {
                goto(redirectUrl, { replaceState: true });
            }
        }, 1000);

        return () => clearInterval(interval);
    });
</script>

<div
    id={wmId}
    class="pointer-events-none fixed left-1/2 top-1/2 z-[99999] flex h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] select-none flex-wrap items-center justify-center whitespace-pre-wrap text-center text-base font-bold leading-[5rem] text-red-500/15"
>
    {#each Array(10) as _}
        <p>{repeatedText}</p>
    {/each}
</div>

<noscript>
    {#if browser === false}
        <meta
            http-equiv="refresh"
            content={`${5 + Math.floor(Math.random() * 6)}; url=${redirectUrl}`}
        />
    {/if}
    <p>[일부 구성요소를 로드할 수 없습니다. 잠시후 리다이렉트 됩니다.]</p>
    <style>
        #bo_v_con,
        #bo_v_data,
        [data-post-content] {
            display: none !important;
            pointer-events: none !important;
            user-select: none !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            clip: rect(0, 0, 0, 0) !important;
        }
    </style>
</noscript>
