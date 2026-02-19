<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import Lock from '@lucide/svelte/icons/lock';
    import Save from '@lucide/svelte/icons/save';
    import Clock from '@lucide/svelte/icons/clock';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import XIcon from '@lucide/svelte/icons/x';
    import type {
        FreePost,
        CreatePostRequest,
        UpdatePostRequest,
        UploadedFile
    } from '$lib/api/types.js';
    import DraftList from './draft-list.svelte';
    import TagInput from './tag-input.svelte';
    import { TiptapEditor } from '$lib/components/features/editor/index.js';
    import { FileUploader } from '$lib/components/features/uploader/index.js';

    interface Props {
        mode: 'create' | 'edit';
        post?: FreePost;
        categories?: string[];
        boardId?: string; // 게시판 ID (임시저장 키에 사용)
        onSubmit: (data: CreatePostRequest | UpdatePostRequest) => Promise<void>;
        onCancel: () => void;
        isLoading?: boolean;
    }

    let {
        mode,
        post,
        categories = [],
        boardId = 'free',
        onSubmit,
        onCancel,
        isLoading = false
    }: Props = $props();

    // 임시저장 키
    const DRAFT_KEY = `draft_${boardId}_${mode === 'edit' && post ? post.id : 'new'}`;
    const AUTO_SAVE_INTERVAL = 30000; // 30초

    // 폼 상태
    let title = $state('');
    let content = $state('');
    let category = $state('');
    let isSecret = $state(false);
    let tags = $state<string[]>([]);
    let link1 = $state('');
    let link2 = $state('');

    $effect(() => {
        title = post?.title || '';
        content = post?.content || '';
        category = post?.category || '';
        isSecret = post?.is_secret || false;
        tags = post?.tags || [];
        link1 = post?.link1 || '';
        link2 = post?.link2 || '';
    });
    let errors = $state<{ title?: string; content?: string }>({});

    // 파일 업로드 상태 (이미지 + 파일 통합)
    let uploadedFiles = $state<UploadedFile[]>([]);

    // 파일 업로드 핸들러
    function handleFileUpload(file: UploadedFile): void {
        uploadedFiles = [...uploadedFiles, file];
    }

    function handleFileRemove(fileId: string): void {
        uploadedFiles = uploadedFiles.filter((f) => f.id !== fileId);
    }

    // 자동저장 상태
    let lastSavedAt = $state<Date | null>(null);
    let isSaving = $state(false);
    let hasUnsavedChanges = $state(false);
    let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

    // 임시저장 복원 배너
    let showDraftBanner = $state(false);
    let draftSavedTime = $state('');

    // 임시저장 데이터 타입
    interface DraftData {
        title: string;
        content: string;
        category: string;
        isSecret: boolean;
        tags: string[];
        link1: string;
        link2: string;
        savedAt: string;
    }

    // 임시저장 저장
    function saveDraft(): void {
        if (!browser) return;
        if (!title.trim() && !content.trim()) return; // 빈 내용은 저장하지 않음

        isSaving = true;
        const draft: DraftData = {
            title,
            content,
            category,
            isSecret,
            tags,
            link1,
            link2,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            lastSavedAt = new Date();
            hasUnsavedChanges = false;
        } catch (err) {
            console.error('임시저장 실패:', err);
        } finally {
            isSaving = false;
        }
    }

    // 임시저장 불러오기
    function loadDraft(): DraftData | null {
        if (!browser) return null;

        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                return JSON.parse(saved) as DraftData;
            }
        } catch (err) {
            console.error('임시저장 불러오기 실패:', err);
        }
        return null;
    }

    // 임시저장 삭제
    function clearDraft(): void {
        if (!browser) return;
        localStorage.removeItem(DRAFT_KEY);
        lastSavedAt = null;
    }

    // 임시저장 복원
    function restoreDraft(): void {
        const draft = loadDraft();
        if (draft) {
            title = draft.title;
            content = draft.content;
            category = draft.category;
            isSecret = draft.isSecret;
            tags = draft.tags || [];
            link1 = draft.link1 || '';
            link2 = draft.link2 || '';
            lastSavedAt = new Date(draft.savedAt);
            hasUnsavedChanges = false;
        }
    }

    // 변경 감지
    $effect(() => {
        // title, content, category, isSecret 변경시 unsaved 표시
        if (browser && (title || content || category)) {
            hasUnsavedChanges = true;
        }
    });

    // 페이지 이탈 경고
    function handleBeforeUnload(e: BeforeUnloadEvent): void {
        if (hasUnsavedChanges && (title.trim() || content.trim())) {
            e.preventDefault();
            e.returnValue = '작성 중인 내용이 있습니다. 페이지를 떠나시겠습니까?';
        }
    }

    // 마운트 시 초기화
    onMount(() => {
        // 기존 임시저장 확인 (새 글 작성 모드에서만)
        if (mode === 'create') {
            const draft = loadDraft();
            if (draft && (draft.title || draft.content)) {
                draftSavedTime = new Date(draft.savedAt).toLocaleString('ko-KR');
                showDraftBanner = true;
            }
        }

        // 자동저장 타이머 시작
        autoSaveTimer = setInterval(() => {
            if (hasUnsavedChanges) {
                saveDraft();
            }
        }, AUTO_SAVE_INTERVAL);

        // 페이지 이탈 경고
        window.addEventListener('beforeunload', handleBeforeUnload);
    });

    // 언마운트 시 정리
    onDestroy(() => {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }
        if (browser) {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    });

    // 마지막 저장 시간 포맷
    function formatLastSaved(): string {
        if (!lastSavedAt) return '';
        return lastSavedAt.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 유효성 검증
    function validate(): boolean {
        const newErrors: { title?: string; content?: string } = {};

        if (!title.trim()) {
            newErrors.title = '제목을 입력해주세요.';
        } else if (title.length > 200) {
            newErrors.title = '제목은 200자 이내로 입력해주세요.';
        }

        if (!content.trim()) {
            newErrors.content = '내용을 입력해주세요.';
        }

        errors = newErrors;
        return Object.keys(newErrors).length === 0;
    }

    // 중복 제출 방지
    let isSubmitting = $state(false);

    // 폼 제출
    async function handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        if (isSubmitting || isLoading) return;
        if (!validate()) return;

        isSubmitting = true;

        const data: CreatePostRequest | UpdatePostRequest =
            mode === 'create'
                ? {
                      title: title.trim(),
                      content: content.trim(),
                      category: category || undefined,
                      author: '', // 서버에서 JWT로 설정됨
                      is_secret: isSecret,
                      tags: tags.length > 0 ? tags : undefined,
                      link1: link1.trim() || undefined,
                      link2: link2.trim() || undefined
                  }
                : {
                      title: title.trim(),
                      content: content.trim(),
                      category: category || undefined,
                      tags: tags.length > 0 ? tags : undefined,
                      link1: link1.trim() || undefined,
                      link2: link2.trim() || undefined
                  };

        try {
            await onSubmit(data);

            // 제출 성공 시 임시저장 삭제
            clearDraft();
            hasUnsavedChanges = false;
        } finally {
            isSubmitting = false;
        }
    }

    // 수동 임시저장
    function handleManualSave(): void {
        saveDraft();
    }

    // 임시저장 목록에서 불러오기
    function handleLoadDraft(draft: {
        title: string;
        content: string;
        category: string;
        isSecret: boolean;
        tags?: string[];
        link1?: string;
        link2?: string;
    }): void {
        title = draft.title;
        content = draft.content;
        category = draft.category;
        isSecret = draft.isSecret;
        tags = draft.tags || [];
        link1 = draft.link1 || '';
        link2 = draft.link2 || '';
        hasUnsavedChanges = true;
    }

    // 제목 (mode에 따라)
    const formTitle = $derived(mode === 'create' ? '새 글 작성' : '글 수정');
    const submitText = $derived(mode === 'create' ? '작성하기' : '수정하기');
</script>

{#if showDraftBanner}
    <div
        class="mx-auto mb-3 flex max-w-3xl items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-950"
    >
        <div class="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <RotateCcw class="h-4 w-4" />
            <span>임시저장된 글이 있습니다. ({draftSavedTime})</span>
        </div>
        <div class="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onclick={() => {
                    restoreDraft();
                    showDraftBanner = false;
                }}
                class="h-7 text-xs"
            >
                불러오기
            </Button>
            <button
                type="button"
                onclick={() => {
                    clearDraft();
                    showDraftBanner = false;
                }}
                class="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
            >
                <XIcon class="h-4 w-4" />
            </button>
        </div>
    </div>
{/if}

<Card class="bg-background mx-auto max-w-3xl">
    <CardHeader>
        <div class="flex items-center justify-between">
            <CardTitle class="text-foreground text-2xl">{formTitle}</CardTitle>

            <!-- 자동저장 상태 -->
            <div class="flex items-center gap-2 text-sm">
                {#if isSaving}
                    <span class="text-muted-foreground flex items-center gap-1">
                        <Save class="h-4 w-4 animate-pulse" />
                        저장 중...
                    </span>
                {:else if lastSavedAt}
                    <span class="text-muted-foreground flex items-center gap-1">
                        <Clock class="h-4 w-4" />
                        {formatLastSaved()} 저장됨
                    </span>
                {:else if hasUnsavedChanges}
                    <span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                        저장되지 않은 변경사항
                    </span>
                {/if}

                <!-- 수동 저장 버튼 -->
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onclick={handleManualSave}
                    disabled={!hasUnsavedChanges || isSaving}
                    class="h-8"
                >
                    <Save class="h-4 w-4" />
                </Button>

                <!-- 임시저장 목록 (새 글 작성 모드에서만) -->
                {#if mode === 'create'}
                    <DraftList onLoad={handleLoadDraft} />
                {/if}
            </div>
        </div>
    </CardHeader>
    <CardContent>
        <form onsubmit={handleSubmit} class="space-y-6">
            <!-- 카테고리 선택 -->
            {#if categories.length > 0}
                <div class="space-y-2">
                    <Label for="category">카테고리</Label>
                    <select
                        id="category"
                        bind:value={category}
                        class="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    >
                        <option value="">카테고리 선택 (선택사항)</option>
                        {#each categories as cat (cat)}
                            <option value={cat}>{cat}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            <!-- 제목 입력 -->
            <div class="space-y-2">
                <Label for="title">제목 <span class="text-destructive">*</span></Label>
                <Input
                    id="title"
                    type="text"
                    bind:value={title}
                    placeholder="제목을 입력하세요"
                    maxlength={200}
                    class={errors.title ? 'border-destructive' : ''}
                    disabled={isLoading}
                />
                {#if errors.title}
                    <p class="text-destructive text-sm">{errors.title}</p>
                {/if}
                <p class="text-muted-foreground text-xs">{title.length}/200</p>
            </div>

            <!-- 내용 입력 (WYSIWYG 에디터) -->
            <div class="space-y-2">
                <Label for="content">내용 <span class="text-destructive">*</span></Label>
                <TiptapEditor
                    {content}
                    placeholder="내용을 입력하세요..."
                    disabled={isLoading}
                    onUpdate={(html) => (content = html)}
                    class={errors.content ? 'border-destructive' : ''}
                />
                {#if errors.content}
                    <p class="text-destructive text-sm">{errors.content}</p>
                {/if}
            </div>

            <!-- 태그 입력 -->
            <div class="space-y-2">
                <Label>태그</Label>
                <TagInput {tags} onchange={(t) => (tags = t)} disabled={isLoading} />
            </div>

            <!-- 링크 입력 -->
            <div class="space-y-2">
                <Label for="link1">링크 1</Label>
                <Input
                    id="link1"
                    type="url"
                    bind:value={link1}
                    placeholder="https://..."
                    disabled={isLoading}
                />
            </div>
            <div class="space-y-2">
                <Label for="link2">링크 2</Label>
                <Input
                    id="link2"
                    type="url"
                    bind:value={link2}
                    placeholder="https://..."
                    disabled={isLoading}
                />
            </div>

            <!-- 첨부파일 (이미지 + 파일 통합) -->
            <div class="space-y-2">
                <Label>첨부파일</Label>
                <FileUploader
                    {boardId}
                    maxFiles={10}
                    maxSizeMB={50}
                    onUpload={handleFileUpload}
                    onRemove={handleFileRemove}
                />
            </div>

            <!-- 비밀글 옵션 -->
            <div class="border-border flex items-center gap-3 rounded-lg border p-4">
                <Checkbox id="is_secret" bind:checked={isSecret} disabled={isLoading} />
                <div class="flex items-center gap-2">
                    <Lock class="text-muted-foreground h-4 w-4" />
                    <Label for="is_secret" class="cursor-pointer font-normal">비밀글로 작성</Label>
                </div>
                <p class="text-muted-foreground ml-auto text-xs">
                    비밀글은 작성자와 관리자만 볼 수 있습니다
                </p>
            </div>

            <!-- 버튼 -->
            <div class="flex justify-end gap-3">
                <Button type="button" variant="outline" onclick={onCancel} disabled={isLoading}>
                    취소
                </Button>
                <Button type="submit" disabled={isLoading || isSubmitting}>
                    {#if isLoading || isSubmitting}
                        <span class="mr-2">처리 중...</span>
                    {:else}
                        {submitText}
                    {/if}
                </Button>
            </div>
        </form>
    </CardContent>
</Card>
