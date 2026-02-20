<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { BoardPermissions } from '$lib/api/types.js';
    import { apiClient } from '$lib/api/index.js';
    import Send from '@lucide/svelte/icons/send';
    import X from '@lucide/svelte/icons/x';
    import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
    import Lock from '@lucide/svelte/icons/lock';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import { MentionAutocomplete } from '$lib/components/features/mention/index.js';
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
        showSecretOption?: boolean; // deprecated: 관리자 레벨 기반으로 자동 판단
        /** 게시판 권한 정보 (서버에서 계산) */
        permissions?: BoardPermissions;
        /** 댓글 작성에 필요한 레벨 (하위호환용) */
        requiredCommentLevel?: number;
        /** 게시판 ID (이미지 업로드용) */
        boardId?: string;
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
        boardId = 'free'
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
    let fileInputRef = $state<HTMLInputElement | null>(null);

    // 이미지 업로드 상태
    let uploadedImages = $state<string[]>([]);
    let isUploading = $state(false);

    const MAX_IMAGES = 3;
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    // 대댓글 모드일 때 플레이스홀더 변경
    const actualPlaceholder = $derived(
        isReplyMode && parentAuthor ? `@${parentAuthor}님에게 답글 작성...` : placeholder
    );

    // 제출 가능 여부 (텍스트 또는 이미지 중 하나라도 있으면 OK)
    const canSubmit = $derived(content.trim().length > 0 || uploadedImages.length > 0);

    // 제출 핸들러
    async function handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        // 텍스트와 이미지 모두 없으면 에러
        if (!content.trim() && uploadedImages.length === 0) {
            error = '댓글 내용을 입력하거나 이미지를 첨부해주세요.';
            return;
        }

        error = null;

        try {
            const images = uploadedImages.length > 0 ? [...uploadedImages] : undefined;
            await onSubmit(content.trim(), parentId, isSecret, images);
            content = ''; // 성공 시 입력 초기화
            isSecret = false;
            uploadedImages = [];
        } catch (err) {
            error = err instanceof Error ? err.message : '댓글 작성에 실패했습니다.';
        }
    }

    // 취소 핸들러
    function handleCancel(): void {
        content = '';
        isSecret = false;
        error = null;
        uploadedImages = [];
        onCancel?.();
    }

    // 툴바에서 텍스트 삽입
    function insertText(text: string): void {
        if (textareaRef) {
            const start = textareaRef.selectionStart;
            const end = textareaRef.selectionEnd;
            content = content.substring(0, start) + text + content.substring(end);
            // 커서를 삽입된 텍스트 뒤로 이동
            requestAnimationFrame(() => {
                if (textareaRef) {
                    const newPos = start + text.length;
                    textareaRef.selectionStart = newPos;
                    textareaRef.selectionEnd = newPos;
                    textareaRef.focus();
                }
            });
        } else {
            content += text;
        }
    }

    // 파일 선택 트리거
    function triggerFileSelect(): void {
        fileInputRef?.click();
    }

    // 이미지 파일 처리
    async function handleFiles(files: FileList | File[]): Promise<void> {
        const fileArray = Array.from(files);
        const remaining = MAX_IMAGES - uploadedImages.length;
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
                uploadedImages = [...uploadedImages, result.url];
            } catch (err) {
                error = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
            } finally {
                isUploading = false;
            }
        }
    }

    // 파일 input 변경
    function handleFileChange(e: Event): void {
        const input = e.currentTarget as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            handleFiles(input.files);
            input.value = ''; // 리셋하여 같은 파일 재선택 허용
        }
    }

    // 클립보드 붙여넣기 이미지 처리
    function handlePaste(e: ClipboardEvent): void {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) imageFiles.push(file);
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            handleFiles(imageFiles);
        }
    }

    // 업로드된 이미지 제거
    function removeImage(index: number): void {
        uploadedImages = uploadedImages.filter((_, i) => i !== index);
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
                    onpaste={handlePaste}
                />
                <MentionAutocomplete textarea={textareaRef} />

                <!-- 업로드된 이미지 미리보기 -->
                {#if uploadedImages.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each uploadedImages as imageUrl, i}
                            <div class="group relative">
                                <img
                                    src={imageUrl}
                                    alt="첨부 이미지 {i + 1}"
                                    class="h-16 w-16 rounded-md border object-cover"
                                />
                                <button
                                    type="button"
                                    onclick={() => removeImage(i)}
                                    class="bg-destructive text-destructive-foreground absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                    title="이미지 제거"
                                >
                                    ×
                                </button>
                            </div>
                        {/each}
                        {#if isUploading}
                            <div
                                class="flex h-16 w-16 items-center justify-center rounded-md border"
                            >
                                <Loader2 class="text-muted-foreground h-5 w-5 animate-spin" />
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- 툴바 + 버튼 한 줄 -->
                <div class="flex flex-wrap items-center gap-1">
                    <CommentToolbar
                        onInsertText={insertText}
                        onSelectImage={triggerFileSelect}
                        disabled={isLoading}
                        {boardId}
                    />

                    <div class="ml-auto flex items-center gap-2">
                        <!-- 비밀댓글 옵션 (관리자만) -->
                        {#if authStore.user?.mb_level != null && authStore.user.mb_level >= 10}
                            <label
                                class="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm"
                            >
                                <Checkbox bind:checked={isSecret} disabled={isLoading} />
                                <Lock class="h-3.5 w-3.5" />
                                <span>비밀댓글</span>
                            </label>
                        {/if}

                        {#if isReplyMode}
                            <Button type="button" variant="ghost" size="sm" onclick={handleCancel}>
                                <X class="mr-1 h-4 w-4" />
                                취소
                            </Button>
                        {/if}
                        <Button type="submit" size="sm" disabled={isLoading || !canSubmit}>
                            {#if isLoading}
                                작성 중...
                            {:else}
                                <Send class="mr-2 h-4 w-4" />
                                {isReplyMode ? '답글 작성' : '댓글 작성'}
                            {/if}
                        </Button>
                    </div>
                </div>

                {#if error}
                    <p class="text-destructive text-sm">{error}</p>
                {/if}
            </div>
        </div>

        <!-- 숨겨진 파일 input -->
        <input
            bind:this={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            class="hidden"
            onchange={handleFileChange}
        />
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
