<script lang="ts">
    import { untrack } from 'svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import { authStore } from '$lib/stores/auth.svelte.js';
    import {
        canUseCertifiedAction,
        getCertificationBlockedMessage,
        goToCertification
    } from '$lib/utils/certification-gate.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import type { BoardPermissions } from '$lib/api/types.js';
    import { apiClient } from '$lib/api/index.js';
    import { stripAdminMentions } from '$lib/utils/sanitize-mentions.js';
    import Send from '@lucide/svelte/icons/send';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import X from '@lucide/svelte/icons/x';
    import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
    import Lock from '@lucide/svelte/icons/lock';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import type { Component } from 'svelte';
    import CommentToolbar from './comment-toolbar.svelte';

    interface Props {
        onSubmit: (
            content: string,
            parentId?: string | number,
            isSecret?: boolean,
            images?: string[]
        ) => Promise<void>;
        onCancel?: () => void;
        placeholder?: string;
        isLoading?: boolean;
        parentId?: string | number;
        parentAuthor?: string;
        isReplyMode?: boolean;
        showSecretOption?: boolean;
        permissions?: BoardPermissions;
        requiredCommentLevel?: number;
        boardId?: string;
        onRefresh?: () => void;
        isRefreshing?: boolean;
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
        requiredCommentLevel = 3,
        boardId = 'free',
        onRefresh,
        isRefreshing = false
    }: Props = $props();

    const canComment = $derived.by(() => {
        if (!authStore.isAuthenticated) return false;
        if (permissions) {
            return isReplyMode ? permissions.can_reply : permissions.can_comment;
        }
        const userLevel = authStore.user?.mb_level ?? 1;
        return userLevel >= requiredCommentLevel;
    });

    const permissionMessage = $derived(`레벨 ${requiredCommentLevel} 이상 작성 가능`);

    let commentAvatarUrl = $derived(
        getAvatarUrl(authStore.user?.mb_image, authStore.user?.mb_image_updated_at) || null
    );
    let commentAvatarFailed = $state(false);

    $effect(() => {
        if (authStore.user) untrack(() => (commentAvatarFailed = false));
    });

    let content = $state('');
    let error = $state<string | null>(null);
    let editorRef = $state<any>(null);
    let fileInputRef = $state<HTMLInputElement | null>(null);

    // === CommentEditor 동적 로드 ===
    let LazyCommentEditor = $state<Component | null>(null);
    let editorLoading = $state(false);

    function loadEditor(): void {
        if (LazyCommentEditor || editorLoading) return;
        editorLoading = true;
        import('./comment-editor.svelte').then((m) => {
            LazyCommentEditor = m.default;
            editorLoading = false;
        });
    }

    // 대댓글: 폼이 마운트되면 바로 에디터 로드 시작
    $effect(() => {
        if (isReplyMode && canComment) loadEditor();
    });

    // 이미지 업로드 상태
    let isUploading = $state(false);

    const MAX_IMAGES = 3;
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    const actualPlaceholder = $derived(
        isReplyMode && parentAuthor ? `@${parentAuthor}님에게 답글 작성...` : placeholder
    );

    // 제출 가능 여부 — Tiptap 빈 상태 <p></p> 대응
    const canSubmit = $derived(
        content.replace(/<[^>]*>/g, '').trim().length > 0 || content.includes('<img ')
    );

    // 앙티콘 이미지를 {emo:filename} 텍스트로 복원
    function convertEmoticonImages(html: string): string {
        return html.replace(
            /<img[^>]+src="\/emoticons\/([^"]+)"[^>]*>/g,
            (_match, filename) => `{emo:${filename}}`
        );
    }

    let isSubmitting = $state(false);

    async function handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        if (isSubmitting || isLoading) return;

        if (!canSubmit) {
            error = '댓글 내용을 입력해주세요.';
            return;
        }

        isSubmitting = true;
        error = null;

        try {
            const submitContent = await stripAdminMentions(convertEmoticonImages(content.trim()));
            await onSubmit(submitContent, parentId, false);
            content = '';
            editorRef?.clear();
        } catch (err) {
            error = err instanceof Error ? err.message : '댓글 작성에 실패했습니다.';
        } finally {
            isSubmitting = false;
        }
    }

    function handleCancel(): void {
        content = '';
        error = null;
        onCancel?.();
    }

    function insertText(text: string): void {
        editorRef?.insertContent(text);
    }

    function triggerFileSelect(): void {
        fileInputRef?.click();
    }

    async function handleFiles(files: FileList | File[]): Promise<void> {
        const fileArray = Array.from(files);
        const insertedImageCount = editorRef?.getImageCount() ?? 0;
        const remaining = MAX_IMAGES - insertedImageCount;
        if (remaining <= 0) {
            error = `이미지는 최대 ${MAX_IMAGES}개까지 첨부할 수 있습니다.`;
            return;
        }

        const toUpload = fileArray.slice(0, remaining);

        for (const file of toUpload) {
            if (!file.type.startsWith('image/')) {
                error = '이미지 파일만 업로드할 수 있습니다.';
                continue;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                error = '이미지 크기는 10MB를 초과할 수 없습니다.';
                continue;
            }

            isUploading = true;
            error = null;
            try {
                const result = await apiClient.uploadImage(boardId, file);
                if (!result?.url) {
                    error = '이미지 URL을 받지 못했습니다.';
                    continue;
                }
                editorRef?.insertImage(result.url, '첨부 이미지');
            } catch (err) {
                error = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
            } finally {
                isUploading = false;
            }
        }
    }

    function handleFileChange(e: Event): void {
        const input = e.currentTarget as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            handleFiles(input.files);
            input.value = '';
        }
    }
</script>

{#if canComment}
    <form onsubmit={handleSubmit} class="space-y-2">
        {#if isReplyMode}
            <div class="text-muted-foreground flex items-center gap-2 text-sm">
                <CornerDownRight class="h-4 w-4" />
                <span>
                    <span class="text-foreground font-medium">@{parentAuthor}</span>님에게 답글 작성
                </span>
            </div>
        {/if}

        <div class="flex items-start gap-3">
            <div
                class="flex size-10 shrink-0 items-center justify-center rounded-full {isReplyMode
                    ? 'hidden sm:flex'
                    : ''} {commentAvatarUrl && !commentAvatarFailed
                    ? 'overflow-hidden'
                    : 'bg-primary text-primary-foreground'}"
            >
                {#if commentAvatarUrl && !commentAvatarFailed}
                    <img
                        src={commentAvatarUrl}
                        alt={authStore.user?.mb_name || ''}
                        class="h-full w-full object-cover"
                        onerror={() => {
                            commentAvatarFailed = true;
                        }}
                    />
                {:else}
                    {authStore.user?.mb_name.charAt(0).toUpperCase() || 'U'}
                {/if}
            </div>

            <div class="relative min-w-0 flex-1 space-y-2">
                {#if LazyCommentEditor}
                    <LazyCommentEditor
                        bind:this={editorRef}
                        placeholder={actualPlaceholder}
                        disabled={isLoading}
                        onUpdate={(html: string) => {
                            content = html;
                        }}
                        onImagePaste={(file: File) => handleFiles([file])}
                        onSubmitShortcut={() => {
                            if (canSubmit && !isLoading) handleSubmit(new Event('submit'));
                        }}
                        class={error ? 'border-destructive' : ''}
                    />
                {:else}
                    <!-- 에디터 로드 전 플레이스홀더 — hover로 preload, click으로 활성화 -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="border-border bg-background text-muted-foreground min-h-20 cursor-text rounded-lg border p-3 text-sm"
                        onmouseenter={loadEditor}
                        onfocusin={loadEditor}
                        onclick={loadEditor}
                        onkeydown={loadEditor}
                    >
                        {#if editorLoading}
                            <span class="animate-pulse">에디터 로딩 중...</span>
                        {:else}
                            {actualPlaceholder}
                        {/if}
                    </div>
                {/if}

                {#if isUploading}
                    <div class="text-muted-foreground flex items-center gap-2 text-sm">
                        <Loader2 class="h-4 w-4 animate-spin" />
                        <span>이미지 업로드 중...</span>
                    </div>
                {/if}

                <!-- 툴바 + 버튼 한 줄 -->
                <div class="flex flex-wrap items-center gap-1">
                    <CommentToolbar
                        onInsertText={insertText}
                        onSelectImage={triggerFileSelect}
                        onInsertEmoticon={(filename) => {
                            editorRef?.insertImage(`/emoticons/${filename}`, filename);
                        }}
                        disabled={isLoading}
                        {boardId}
                    />

                    <div class="ml-auto flex items-center gap-2">
                        {#if isReplyMode}
                            <Button type="button" variant="ghost" size="sm" onclick={handleCancel}>
                                <X class="mr-1 h-4 w-4" />
                                취소
                            </Button>
                        {/if}
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isLoading || isSubmitting || !canSubmit}
                            title="Alt+Enter / Ctrl+Enter"
                        >
                            {#if isLoading || isSubmitting}
                                작성 중...
                            {:else}
                                <Send class="mr-2 h-4 w-4" />
                                {isReplyMode ? '답글 작성' : '댓글 작성'}
                            {/if}
                        </Button>
                        {#if onRefresh}
                            <button
                                type="button"
                                onclick={onRefresh}
                                disabled={isRefreshing}
                                class="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors disabled:opacity-50"
                                title="댓글 새로고침"
                            >
                                <RefreshCw class="size-4 {isRefreshing ? 'animate-spin' : ''}" />
                            </button>
                        {/if}
                    </div>
                </div>

                {#if error}
                    <p class="text-destructive text-sm">{error}</p>
                {/if}
            </div>
        </div>

        <input
            bind:this={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            class="hidden"
            onchange={handleFileChange}
        />
    </form>
{:else if authStore.isAuthenticated && !canUseCertifiedAction(authStore.user, boardId)}
    <div class="bg-muted/50 rounded-md p-4 text-center">
        <p class="text-muted-foreground">
            {isReplyMode ? '답글' : '댓글'}을 작성하려면
            <button
                type="button"
                onclick={goToCertification}
                class="text-primary hover:underline"
                title={getCertificationBlockedMessage(boardId)}
            >
                실명인증
            </button>
            이 필요합니다.
        </p>
    </div>
{:else if authStore.isAuthenticated}
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
