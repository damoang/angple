<!--
  가입인사 글쓰기 전 예절 안내 — 영화 자막처럼 화면 가운데에 잠깐 떴다 사라진다.

  왜 모달이 아닌가: 모달은 "닫기"를 누르게 만들어 읽지 않고 닫는 습관을 만든다.
  자막은 누를 것이 없어서 읽히고, 저절로 사라져서 방해가 되지 않는다.

  ⛔ hello 게시판 1회 한정. 규칙은 `$lib/utils/write-etiquette-notice.ts` 가 단일 근원이다.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import {
        ETIQUETTE_LINE_DURATION_MS,
        ETIQUETTE_NOTICE_LINES,
        ETIQUETTE_NOTICE_SEEN_KEY,
        shouldShowEtiquetteNotice
    } from '$lib/utils/write-etiquette-notice.js';

    let { boardId, isAuthenticated = false }: { boardId: string; isAuthenticated?: boolean } =
        $props();

    // SSR 에서는 항상 false — localStorage 를 모르는 상태로 그리면 hydration 이 어긋난다.
    let visible = $state(false);
    let lineIndex = $state(0);
    let reduceMotion = $state(false);

    // ⛔ 평범한 let. $state 로 두고 $effect 안에서 읽고 쓰면 자기 재트리거가 난다
    //    (2026-08-01 auth 429 사고).
    let timers: ReturnType<typeof setTimeout>[] = [];

    function clearTimers(): void {
        for (const t of timers) clearTimeout(t);
        timers = [];
    }

    function dismiss(): void {
        clearTimers();
        visible = false;
    }

    onMount(() => {
        let seenMark: string | null = null;
        try {
            seenMark = localStorage.getItem(ETIQUETTE_NOTICE_SEEN_KEY);
        } catch {
            // 시크릿 모드 등 localStorage 차단 환경 — 기록을 못 읽으면 '안 본 것'으로 본다.
            // 매번 뜨는 쪽이 한 번도 못 보는 쪽보다 낫다.
            seenMark = null;
        }

        if (!shouldShowEtiquetteNotice({ boardId, seenMark, isAuthenticated })) {
            return;
        }

        reduceMotion =
            typeof matchMedia === 'function' &&
            matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 본 기록은 '띄우기로 결정한 순간' 남긴다. 다 보고 나서 남기면 도중에 뒤로가기한
        // 사람에게 영원히 다시 뜬다.
        try {
            localStorage.setItem(ETIQUETTE_NOTICE_SEEN_KEY, new Date().toISOString());
        } catch {
            // 저장 실패는 치명적이지 않다 — 다음에 한 번 더 볼 뿐이다.
        }

        visible = true;
        timers.push(setTimeout(() => (armed = true), 400));

        const hold = reduceMotion ? 1800 : ETIQUETTE_LINE_DURATION_MS;
        if (reduceMotion) {
            // 애니메이션을 원치 않는 분에게는 두 줄을 한 번에 보여주고 짧게 끝낸다.
            lineIndex = ETIQUETTE_NOTICE_LINES.length;
            timers.push(setTimeout(dismiss, hold));
        } else {
            for (let i = 1; i < ETIQUETTE_NOTICE_LINES.length; i++) {
                timers.push(setTimeout(() => (lineIndex = i), hold * i));
            }
            timers.push(setTimeout(dismiss, hold * ETIQUETTE_NOTICE_LINES.length));
        }

        // ⛔ 모든 분기에서 정리된다 — onMount 반환값 하나로 모아 둔 이유.
        return clearTimers;
    });

    // 넘기기 수단은 창 단위로 단다. 스크림 div 에 onclick 을 달면 상호작용 요소가 아닌
    // 것에 클릭 핸들러가 붙어 a11y 규칙에 걸리고, 그렇다고 버튼을 만들면 "읽지 않고 닫기"를
    // 유도한다. 화면 아무 곳이나 눌러도 넘어가되 마크업은 순수하게 둔다.
    //
    // ⛔ 400ms 무장 지연이 필요하다. 글쓰기 버튼을 누른 그 입력의 뒤따르는 이벤트가
    //    자막을 즉시 지워버리면 아무도 읽지 못한다.
    let armed = false;

    function onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') dismiss();
    }

    function onPointerDown(): void {
        if (armed) dismiss();
    }
</script>

<svelte:window
    onkeydown={visible ? onKeydown : undefined}
    onpointerdown={visible ? onPointerDown : undefined}
/>

{#if visible}
    <div class="etiquette-scrim" class:reduce={reduceMotion} role="status" aria-live="polite">
        <p class="etiquette-eyebrow">가입인사를 남기기 전에</p>
        {#each ETIQUETTE_NOTICE_LINES as line, i (line)}
            {#if reduceMotion || i <= lineIndex}
                <p class="etiquette-line" class:current={reduceMotion || i === lineIndex}>
                    {line}
                </p>
            {/if}
        {/each}
    </div>
{/if}

<style>
    .etiquette-scrim {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 1.5rem;
        text-align: center;
        /* 영화 자막의 조건 — 배경이 어두워야 글자가 읽힌다. 완전 불투명은 아니라
           뒤의 글쓰기 화면이 비쳐 "잠깐 지나가는 안내"로 읽힌다. */
        background: rgb(0 0 0 / 0.62);
        backdrop-filter: blur(2px);
        animation: etiquette-fade-in 320ms ease-out;
    }

    .etiquette-scrim.reduce {
        animation: none;
    }

    .etiquette-eyebrow {
        margin: 0 0 0.25rem;
        font-size: 0.8125rem;
        letter-spacing: 0.08em;
        color: rgb(255 255 255 / 0.62);
    }

    .etiquette-line {
        margin: 0;
        max-width: 22rem;
        font-size: 1.0625rem;
        line-height: 1.6;
        font-weight: 600;
        color: rgb(255 255 255 / 0.42);
        transition: color 420ms ease-out;
    }

    .etiquette-line.current {
        color: rgb(255 255 255 / 0.97);
    }

    .etiquette-scrim.reduce .etiquette-line {
        color: rgb(255 255 255 / 0.97);
        transition: none;
    }

    @media (min-width: 640px) {
        .etiquette-line {
            max-width: 30rem;
            font-size: 1.25rem;
        }
    }

    @keyframes etiquette-fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
