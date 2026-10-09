<!--
  이메일 표지(`{email:<hex>}`)가 섞인 평문(글 제목 등)을 렌더한다.
  유효한 표지는 「이메일 보기」 버튼, 나머지는 글자 그대로(텍스트 보간 — {@html} 없음).
  버튼이 링크 안에 있어도 이동하지 않도록 기본 동작과 전파를 막는다.
-->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import {
        closeEmailReveal,
        openEmailReveal,
        splitEmailMarkers
    } from '$lib/utils/email-reveal.js';

    let { text = '' }: { text?: string | null } = $props();

    const segments = $derived(splitEmailMarkers(text ?? ''));
    let opened = false;

    function reveal(e: MouseEvent & { currentTarget: HTMLButtonElement }): void {
        e.preventDefault();
        e.stopPropagation();
        opened = true;
        openEmailReveal(e.currentTarget);
    }

    onDestroy(() => {
        if (opened) closeEmailReveal();
    });
</script>

{#each segments as seg, i (i)}{#if 'hex' in seg}<button
            type="button"
            class="email-reveal"
            data-er={seg.hex}
            aria-haspopup="dialog"
            onclick={reveal}>이메일 보기</button
        >{:else}{seg.text}{/if}{/each}
