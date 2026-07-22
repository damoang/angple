<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { canUseCertifiedAction } from '$lib/utils/certification-gate.js';
    import {
        WELCOME_PACK_PREFIX,
        hasStampedWelcome,
        welcomeStampContent
    } from '$lib/utils/welcome-stamp.js';
    import type { BoardPermissions, FreeComment } from '$lib/api/types.js';
    import { toast } from 'svelte-sonner';
    import Check from '@lucide/svelte/icons/check';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    interface Props {
        boardId: string;
        comments: FreeComment[];
        // ⛔ 반드시 부모의 기존 댓글 작성 핸들러(handleCreateComment)를 받아야 한다.
        //    여기서 apiClient 를 직접 부르면 optimistic 반영·refetch·가시성 지연 보정(#12548)을
        //    전부 다시 구현해야 한다.
        onSend: (content: string) => Promise<void>;
        permissions?: BoardPermissions;
        requiredCommentLevel?: number;
        isRestricted?: boolean;
        disabled?: boolean;
    }

    let {
        boardId,
        comments,
        onSend,
        permissions,
        requiredCommentLevel = 3,
        isRestricted = false,
        disabled = false
    }: Props = $props();

    interface EmoticonItem {
        file: string;
        thumb: string | null;
    }

    let stamps = $state<EmoticonItem[]>([]);
    let sendingFile = $state<string | null>(null);

    // 비로그인·이용제한·실명인증 미비·댓글 권한 미달 = 미노출.
    // comment-form 의 canComment 판정과 같은 기준을 유지할 것 — 여기만 느슨하면
    // 스탬프 탭이 서버 403 으로 튕기는 반쪽 UI 가 된다.
    const canStamp = $derived.by(() => {
        if (!authStore.isAuthenticated || isRestricted) return false;
        if (!canUseCertifiedAction(authStore.user, boardId)) return false;
        if (permissions) return permissions.can_comment;
        return (authStore.user?.mb_level ?? 1) >= requiredCommentLevel;
    });

    // 글당 1회는 클라 판정만 — 우회해도 일반 댓글과 동일 취급이라 서버 강제 불요
    const stamped = $derived(hasStampedWelcome(comments, authStore.user?.mb_id));

    // welcome 팩이 없거나 API 실패면 조용히 미노출 (스탬프는 부가 기능)
    fetch('/api/emoticons/list')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('API error'))))
        .then((data: { packs: Array<{ prefix: string; items: EmoticonItem[] }> }) => {
            stamps = data.packs.find((p) => p.prefix === WELCOME_PACK_PREFIX)?.items ?? [];
        })
        .catch(() => {
            stamps = [];
        });

    async function sendStamp(file: string): Promise<void> {
        if (stamped || sendingFile || disabled) return;
        sendingFile = file;
        try {
            await onSend(welcomeStampContent(file));
        } catch (err) {
            console.error('환영 스탬프 등록 실패:', err);
            toast.error(err instanceof Error ? err.message : '환영 스탬프를 남기지 못했습니다.');
        } finally {
            sendingFile = null;
        }
    }
</script>

{#if canStamp && stamps.length > 0}
    <div
        class="flex items-center gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/20"
    >
        <span class="text-muted-foreground shrink-0 text-xs font-medium">
            {#if stamped}
                <span class="flex items-center gap-1">
                    <Check class="size-3.5 text-green-600 dark:text-green-400" />
                    환영 완료 ✓
                </span>
            {:else}
                앙티콘으로 환영하기
            {/if}
        </span>
        <div class="flex min-w-0 gap-1 overflow-x-auto">
            {#each stamps as item (item.file)}
                <button
                    type="button"
                    onclick={() => sendStamp(item.file)}
                    disabled={stamped || !!sendingFile || disabled}
                    class="relative shrink-0 rounded-md p-1 transition-colors hover:bg-amber-100/80 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-amber-900/30"
                    title={stamped
                        ? '이미 환영 스탬프를 남겼어요'
                        : '탭 한 번으로 환영 댓글 남기기'}
                >
                    <img
                        src="/emoticons/{item.thumb || item.file}"
                        alt="환영 앙티콘"
                        class="size-9 object-contain {stamped ? 'opacity-40 grayscale' : ''}"
                        loading="lazy"
                    />
                    {#if sendingFile === item.file}
                        <span
                            class="bg-background/60 absolute inset-0 flex items-center justify-center rounded-md"
                        >
                            <Loader2 class="size-4 animate-spin" />
                        </span>
                    {/if}
                </button>
            {/each}
        </div>
    </div>
{/if}
