<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { BoardPermissions } from '$lib/api/types.js';
    import Send from '@lucide/svelte/icons/send';
    import X from '@lucide/svelte/icons/x';
    import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
    import Lock from '@lucide/svelte/icons/lock';
    import { MentionAutocomplete } from '$lib/components/features/mention/index.js';

    interface Props {
        onSubmit: (
            content: string,
            parentId?: string | number,
            isSecret?: boolean
        ) => Promise<void>;
        onCancel?: () => void;
        placeholder?: string;
        isLoading?: boolean;
        parentId?: string | number;
        parentAuthor?: string;
        isReplyMode?: boolean;
        showSecretOption?: boolean;
        /** 게시판 권한 정보 (서버에서 계산) */
        permissions?: BoardPermissions;
        /** 댓글 작성에 필요한 레벨 (하위호환용) */
        requiredCommentLevel?: number;
    }

    let {
        onSubmit,
        onCancel,
        placeholder = '댓글을 입력하세요...',
        isLoading = false,
        parentId,
        parentAuthor,
        isReplyMode = false,
        showSecretOption = true,
        permissions,
        requiredCommentLevel = 1
    }: Props = $props();

    // 댓글 작성 권한 체크
    const canComment = $derived(() => {
        if (!authStore.isAuthenticated) return false;
        // 서버에서 계산된 권한 정보가 있으면 사용
        if (permissions) {
            return permissions.can_comment;
        }
        // 하위호환: 클라이언트에서 레벨 비교
        const userLevel = authStore.user?.mb_level ?? 1;
        return userLevel >= requiredCommentLevel;
    });

    // 권한 부족 시 표시할 메시지
    const permissionMessage = $derived(`레벨 ${requiredCommentLevel} 이상 작성 가능`);

    let content = $state('');
    let isSecret = $state(false);
    let error = $state<string | null>(null);
    let textareaRef = $state<HTMLTextAreaElement | null>(null);

    // 대댓글 모드일 때 플레이스홀더 변경
    const actualPlaceholder = $derived(
        isReplyMode && parentAuthor ? `@${parentAuthor}님에게 답글 작성...` : placeholder
    );

    // 제출 핸들러
    async function handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        if (!content.trim()) {
            error = '댓글 내용을 입력해주세요.';
            return;
        }

        error = null;

        try {
            await onSubmit(content.trim(), parentId, isSecret);
            content = ''; // 성공 시 입력 초기화
            isSecret = false;
        } catch (err) {
            error = err instanceof Error ? err.message : '댓글 작성에 실패했습니다.';
        }
    }

    // 취소 핸들러
    function handleCancel(): void {
        content = '';
        isSecret = false;
        error = null;
        onCancel?.();
    }
</script>

{#if canComment()}
    <form onsubmit={handleSubmit} class="space-y-3">
        {#if isReplyMode}
            <!-- 대댓글 모드 표시 -->
            <div class="text-muted-foreground flex items-center gap-2 text-sm">
                <CornerDownRight class="h-4 w-4" />
                <span>
                    <span class="text-foreground font-medium">@{parentAuthor}</span>님에게 답글 작성
                </span>
            </div>
        {/if}

        <div class="flex items-start gap-3">
            <!-- 사용자 아바타 -->
            <div
                class="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
            >
                {authStore.user?.mb_name.charAt(0).toUpperCase() || 'U'}
            </div>

            <div class="relative flex-1 space-y-2">
                <Textarea
                    bind:ref={textareaRef}
                    bind:value={content}
                    placeholder={actualPlaceholder}
                    rows={isReplyMode ? 2 : 3}
                    class={error ? 'border-destructive' : ''}
                    disabled={isLoading}
                />
                <MentionAutocomplete textarea={textareaRef} />
                {#if error}
                    <p class="text-destructive text-sm">{error}</p>
                {/if}
            </div>
        </div>

        <div class="flex items-center justify-between">
            <!-- 비밀댓글 옵션 -->
            {#if showSecretOption}
                <label class="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox bind:checked={isSecret} disabled={isLoading} />
                    <Lock class="h-3.5 w-3.5" />
                    <span>비밀댓글</span>
                </label>
            {:else}
                <div></div>
            {/if}

            <div class="flex gap-2">
                {#if isReplyMode}
                    <Button type="button" variant="ghost" size="sm" onclick={handleCancel}>
                        <X class="mr-1 h-4 w-4" />
                        취소
                    </Button>
                {/if}
                <Button
                    type="submit"
                    size={isReplyMode ? 'sm' : 'default'}
                    disabled={isLoading || !content.trim()}
                >
                    {#if isLoading}
                        작성 중...
                    {:else}
                        <Send class="mr-2 h-4 w-4" />
                        {isReplyMode ? '답글 작성' : '댓글 작성'}
                    {/if}
                </Button>
            </div>
        </div>
    </form>
{:else if authStore.isAuthenticated}
    <!-- 로그인했지만 권한 부족 -->
    <div class="bg-muted/50 rounded-md p-4 text-center">
        <p class="text-muted-foreground flex items-center justify-center gap-2">
            <Lock class="h-4 w-4" />
            {isReplyMode ? '답글' : '댓글'} 작성 권한이 없습니다. ({permissionMessage})
        </p>
    </div>
{:else}
    <div class="bg-muted/50 rounded-md p-4 text-center">
        <p class="text-muted-foreground">
            {isReplyMode ? '답글' : '댓글'}을 작성하려면
            <button
                type="button"
                onclick={() => authStore.redirectToLogin()}
                class="text-primary hover:underline"
            >
                로그인
            </button>
            이 필요합니다.
        </p>
    </div>
{/if}
