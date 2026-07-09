<script lang="ts">
    import { onDestroy } from 'svelte';
    import Scale from '@lucide/svelte/icons/scale';
    import Eye from '@lucide/svelte/icons/eye';
    import Lock from '@lucide/svelte/icons/lock';
    import { disciplineRevealStore } from '$lib/stores/discipline-reveal.svelte.js';
    import { authStore } from '$lib/stores/auth.svelte.js';

    interface Props {
        children: import('svelte').Snippet;
        isComment?: boolean;
        // 비로그인 사용자는 children 자체를 렌더하지 않아 봇 추출 차단.
        // 로그인 사용자만 blur + 보기 토글 동작.
        isLoggedIn?: boolean;
        // inline=true: 제목처럼 한 줄 인라인 텍스트용(작은 blur + 보기 칩). 기본은 블록 박스.
        inline?: boolean;
        // revealed 를 bindable 로 승격 → 제목·본문 인스턴스가 상태를 공유해
        // 어느 "보기"를 눌러도 함께 공개된다. 기본값 false 라 기존 단독 사용처는 무변경.
        revealed?: boolean;
        class?: string;
    }
    let {
        children,
        isComment = false,
        isLoggedIn = false,
        inline = false,
        revealed = $bindable(false),
        class: className = ''
    }: Props = $props();

    const label = $derived(`이용제한 근거 ${isComment ? '댓글' : '글'}`);

    // #12920: 공개 인스턴스 등록 → 페이지가 revealCount > 0 이면 전체화면 워터마크 렌더.
    // 클릭 핸들러가 아닌 상태 관찰 기반: 제목·본문이 bind:revealed 로 상태를 공유해도
    // 인스턴스별 Symbol + 멱등 add/remove 라 이중 증감이 없다.
    const instanceId = Symbol();
    $effect(() => {
        if (revealed) {
            disciplineRevealStore.add(instanceId);
        } else {
            disciplineRevealStore.remove(instanceId);
        }
    });
    onDestroy(() => {
        disciplineRevealStore.remove(instanceId);
    });

    // #12920: 좁은 영역(한 줄 댓글 등) 캡처 시 전체화면 워터마크가 프레임 밖일 수 있어,
    // 공개된 블록 자체에 고밀도 보강 워터마크를 겹친다. viewer(SSR) 우선, authStore 폴백.
    const overlayText = $derived.by(() => {
        const v = disciplineRevealStore.viewer;
        const nickname = v?.nickname || authStore.user?.mb_name || '';
        const userId = v?.userId || authStore.user?.mb_id || '';
        const clientIp = v?.clientIp || '';
        if (!nickname && !userId) return '';
        return `@${nickname}(${userId}) ${clientIp} `.repeat(120);
    });
</script>

{#if inline}
    <!-- 인라인(제목) 변형 -->
    {#if isLoggedIn}
        <span class="inline-flex items-center gap-1 {className}">
            <span
                class={revealed ? '' : 'pointer-events-none select-none blur-sm'}
                aria-hidden={!revealed}
            >
                {@render children()}
            </span>
            {#if !revealed}
                <button
                    type="button"
                    onclick={() => (revealed = true)}
                    class="bg-background inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/40 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                >
                    <Eye class="h-3 w-3" />
                    보기
                </button>
            {/if}
        </span>
    {:else}
        <!-- 비로그인: children 미렌더 → 소스 유출 0 -->
        <span
            class="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-sm font-medium text-amber-700 dark:text-amber-400 {className}"
        >
            <Scale class="h-3.5 w-3.5" />
            {label}
        </span>
    {/if}
{:else}
    <!-- 블록(본문) 변형 -->
    <div class="relative {className}">
        {#if isLoggedIn}
            <div
                class={revealed
                    ? ''
                    : 'pointer-events-none select-none blur-md transition-[filter] duration-200'}
                aria-hidden={!revealed}
            >
                {@render children()}
            </div>
            {#if revealed && overlayText}
                <!-- #12920: 좁은 영역 보강 워터마크. leading-4(1rem)가 댓글 한 줄
                     line-height 보다 작아 어떤 한 줄 캡처에도 식별 텍스트가 교차한다.
                     무회전(모서리 공백 방지), inline(제목) 변형에는 미적용. -->
                <div
                    class="pointer-events-none absolute inset-0 select-none overflow-hidden break-all text-[10px] leading-4 text-red-500/10"
                    aria-hidden="true"
                >
                    {overlayText}
                </div>
            {/if}
            {#if !revealed}
                <div
                    class="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-amber-500/5 p-4 backdrop-blur-sm"
                >
                    <div
                        class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                    >
                        <Scale class="h-3.5 w-3.5" />
                        {label}
                    </div>
                    <button
                        type="button"
                        onclick={() => (revealed = true)}
                        class="bg-background inline-flex items-center gap-1 rounded border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                    >
                        <Eye class="h-3.5 w-3.5" />
                        보기
                    </button>
                </div>
            {/if}
        {:else}
            <!-- 비로그인: children 자체 미렌더 → 페이지 소스에 본문 노출 0 (봇 추출 차단). -->
            <div
                class="flex flex-col items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-4"
            >
                <div
                    class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                >
                    <Scale class="h-3.5 w-3.5" />
                    {label}
                </div>
                <div class="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Lock class="h-3 w-3" />
                    회원만 열람 가능
                </div>
            </div>
        {/if}
    </div>
{/if}
