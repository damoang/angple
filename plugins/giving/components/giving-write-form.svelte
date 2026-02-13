<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import Gift from '@lucide/svelte/icons/gift';
    import Save from '@lucide/svelte/icons/save';
    import Clock from '@lucide/svelte/icons/clock';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import XIcon from '@lucide/svelte/icons/x';
    import type { CreatePostRequest, UpdatePostRequest, UploadedFile } from '$lib/api/types.js';
    import TagInput from '$lib/components/features/board/tag-input.svelte';
    import { TiptapEditor } from '$lib/components/features/editor/index.js';
    import { ImageUploader, FileUploader } from '$lib/components/features/uploader/index.js';

    interface Props {
        boardId: string;
        categories?: string[];
        onSubmit: (data: CreatePostRequest | UpdatePostRequest) => Promise<void>;
        onCancel: () => void;
        isLoading?: boolean;
    }

    let { boardId, categories = [], onSubmit, onCancel, isLoading = false }: Props = $props();

    // 임시저장 키
    const DRAFT_KEY = `draft_${boardId}_giving_new`;
    const AUTO_SAVE_INTERVAL = 30000;

    // 기본 폼 상태
    let title = $state('');
    let content = $state('');
    let category = $state('');
    let tags = $state<string[]>([]);
    let errors = $state<Record<string, string>>({});

    // 나눔 전용 필드
    let itemName = $state('');
    let pointsPerNumber = $state('100');
    let startTime = $state('');
    let endTime = $state('');
    let deliveryType = $state('선불');

    // 이미지/파일 업로드 상태
    let uploadedImages = $state<UploadedFile[]>([]);
    let uploadedFiles = $state<UploadedFile[]>([]);

    function handleImageUpload(file: UploadedFile): void {
        uploadedImages = [...uploadedImages, file];
    }

    function handleImageRemove(fileId: string): void {
        uploadedImages = uploadedImages.filter((img) => img.id !== fileId);
    }

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

    interface DraftData {
        title: string;
        content: string;
        category: string;
        tags: string[];
        itemName: string;
        pointsPerNumber: string;
        startTime: string;
        endTime: string;
        deliveryType: string;
        savedAt: string;
    }

    function saveDraft(): void {
        if (!browser) return;
        if (!title.trim() && !content.trim() && !itemName.trim()) return;

        isSaving = true;
        const draft: DraftData = {
            title,
            content,
            category,
            tags,
            itemName,
            pointsPerNumber,
            startTime,
            endTime,
            deliveryType,
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

    function loadDraft(): DraftData | null {
        if (!browser) return null;
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) return JSON.parse(saved) as DraftData;
        } catch (err) {
            console.error('임시저장 불러오기 실패:', err);
        }
        return null;
    }

    function clearDraft(): void {
        if (!browser) return;
        localStorage.removeItem(DRAFT_KEY);
        lastSavedAt = null;
    }

    function restoreDraft(): void {
        const draft = loadDraft();
        if (draft) {
            title = draft.title;
            content = draft.content;
            category = draft.category;
            tags = draft.tags || [];
            itemName = draft.itemName || '';
            pointsPerNumber = draft.pointsPerNumber || '100';
            startTime = draft.startTime || '';
            endTime = draft.endTime || '';
            deliveryType = draft.deliveryType || '선불';
            lastSavedAt = new Date(draft.savedAt);
            hasUnsavedChanges = false;
        }
    }

    // 변경 감지
    $effect(() => {
        if (browser && (title || content || itemName)) {
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

    onMount(() => {
        const draft = loadDraft();
        if (draft && (draft.title || draft.content || draft.itemName)) {
            draftSavedTime = new Date(draft.savedAt).toLocaleString('ko-KR');
            showDraftBanner = true;
        }

        // 시작시간 기본값: 현재 시간 + 1시간 (분단위 반올림)
        if (!startTime) {
            const now = new Date();
            now.setHours(now.getHours() + 1, 0, 0, 0);
            startTime = formatDatetimeLocal(now);
        }
        // 종료시간 기본값: 시작시간 + 24시간
        if (!endTime) {
            const end = new Date(startTime);
            end.setHours(end.getHours() + 24);
            endTime = formatDatetimeLocal(end);
        }

        autoSaveTimer = setInterval(() => {
            if (hasUnsavedChanges) saveDraft();
        }, AUTO_SAVE_INTERVAL);

        window.addEventListener('beforeunload', handleBeforeUnload);
    });

    onDestroy(() => {
        if (autoSaveTimer) clearInterval(autoSaveTimer);
        if (browser) window.removeEventListener('beforeunload', handleBeforeUnload);
    });

    function formatDatetimeLocal(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatLastSaved(): string {
        if (!lastSavedAt) return '';
        return lastSavedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    // 유효성 검증
    function validate(): boolean {
        const newErrors: Record<string, string> = {};

        if (!title.trim()) newErrors.title = '제목을 입력해주세요.';
        else if (title.length > 200) newErrors.title = '제목은 200자 이내로 입력해주세요.';

        if (!content.trim()) newErrors.content = '내용을 입력해주세요.';

        if (!itemName.trim()) newErrors.itemName = '상품명을 입력해주세요.';

        const points = parseInt(pointsPerNumber, 10);
        if (isNaN(points) || points < 1)
            newErrors.pointsPerNumber = '1 이상의 숫자를 입력해주세요.';

        if (!startTime) newErrors.startTime = '시작일시를 선택해주세요.';
        if (!endTime) newErrors.endTime = '종료일시를 선택해주세요.';

        if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
            newErrors.endTime = '종료일시는 시작일시보다 이후여야 합니다.';
        }

        if (!deliveryType) newErrors.deliveryType = '배송비 유형을 선택해주세요.';

        errors = newErrors;
        return Object.keys(newErrors).length === 0;
    }

    let isSubmitting = $state(false);

    async function handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        if (isSubmitting || isLoading) return;
        if (!validate()) return;

        isSubmitting = true;

        const data: CreatePostRequest = {
            title: title.trim(),
            content: content.trim(),
            category: category || undefined,
            author: '',
            tags: tags.length > 0 ? tags : undefined,
            extra_2: pointsPerNumber,
            extra_3: itemName.trim(),
            extra_4: startTime,
            extra_5: endTime,
            extra_6: deliveryType
        };

        try {
            await onSubmit(data);
            clearDraft();
            hasUnsavedChanges = false;
        } finally {
            isSubmitting = false;
        }
    }

    const deliveryOptions = [
        { value: '선불', label: '선불 (발송자 부담)' },
        { value: '착불', label: '착불 (수령자 부담)' },
        { value: '무료', label: '게시자 부담 (무료배송)' }
    ];
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

<div class="mx-auto max-w-3xl space-y-4">
    <!-- 나눔 정보 카드 -->
    <Card class="bg-background rounded-xl border">
        <CardHeader class="pb-4">
            <div class="flex items-center gap-2">
                <Gift class="text-primary h-5 w-5" />
                <CardTitle class="text-lg">나눔 정보</CardTitle>
            </div>
            <p class="text-muted-foreground text-sm">나눔에 필요한 기본 정보를 입력해주세요.</p>
        </CardHeader>
        <CardContent class="space-y-4">
            <!-- 상품명 -->
            <div class="space-y-2">
                <Label for="itemName" class="text-sm"
                    >상품명 <span class="text-destructive">*</span></Label
                >
                <Input
                    id="itemName"
                    type="text"
                    bind:value={itemName}
                    placeholder="나눔할 상품명을 입력하세요"
                    class={errors.itemName ? 'border-destructive' : ''}
                    disabled={isLoading}
                />
                {#if errors.itemName}
                    <p class="text-destructive text-sm">{errors.itemName}</p>
                {/if}
            </div>

            <!-- 번호당 포인트 -->
            <div class="space-y-2">
                <Label for="pointsPerNumber" class="text-sm"
                    >번호당 포인트 <span class="text-destructive">*</span></Label
                >
                <Input
                    id="pointsPerNumber"
                    type="number"
                    bind:value={pointsPerNumber}
                    placeholder="100"
                    min="1"
                    class={errors.pointsPerNumber ? 'border-destructive' : ''}
                    disabled={isLoading}
                />
                <p class="text-muted-foreground text-xs">응모자가 번호 1개당 지불할 포인트</p>
                {#if errors.pointsPerNumber}
                    <p class="text-destructive text-sm">{errors.pointsPerNumber}</p>
                {/if}
            </div>

            <!-- 시작/종료 시간 (반응형 2열) -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                    <Label for="startTime" class="text-sm"
                        >시작일시 <span class="text-destructive">*</span></Label
                    >
                    <Input
                        id="startTime"
                        type="datetime-local"
                        bind:value={startTime}
                        class={errors.startTime ? 'border-destructive' : ''}
                        disabled={isLoading}
                    />
                    {#if errors.startTime}
                        <p class="text-destructive text-sm">{errors.startTime}</p>
                    {/if}
                </div>
                <div class="space-y-2">
                    <Label for="endTime" class="text-sm"
                        >종료일시 <span class="text-destructive">*</span></Label
                    >
                    <Input
                        id="endTime"
                        type="datetime-local"
                        bind:value={endTime}
                        class={errors.endTime ? 'border-destructive' : ''}
                        disabled={isLoading}
                    />
                    {#if errors.endTime}
                        <p class="text-destructive text-sm">{errors.endTime}</p>
                    {/if}
                </div>
            </div>

            <!-- 배송비 유형 -->
            <div class="space-y-2">
                <Label for="deliveryType" class="text-sm"
                    >배송비 유형 <span class="text-destructive">*</span></Label
                >
                <select
                    id="deliveryType"
                    bind:value={deliveryType}
                    class="border-input bg-background text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    disabled={isLoading}
                >
                    {#each deliveryOptions as opt (opt.value)}
                        <option value={opt.value}>{opt.label}</option>
                    {/each}
                </select>
                {#if errors.deliveryType}
                    <p class="text-destructive text-sm">{errors.deliveryType}</p>
                {/if}
            </div>
        </CardContent>
    </Card>

    <!-- 글 내용 카드 -->
    <Card class="bg-background rounded-xl border">
        <CardHeader>
            <div class="flex items-center justify-between">
                <CardTitle class="text-foreground text-lg">글 내용</CardTitle>
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
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onclick={() => saveDraft()}
                        disabled={!hasUnsavedChanges || isSaving}
                        class="h-8"
                    >
                        <Save class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <form onsubmit={handleSubmit} class="space-y-6">
                <!-- 카테고리 -->
                {#if categories.length > 0}
                    <div class="space-y-2">
                        <Label for="category" class="text-sm">카테고리</Label>
                        <select
                            id="category"
                            bind:value={category}
                            class="border-input bg-background text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        >
                            <option value="">카테고리 선택 (선택사항)</option>
                            {#each categories as cat (cat)}
                                <option value={cat}>{cat}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <!-- 제목 -->
                <div class="space-y-2">
                    <Label for="title" class="text-sm"
                        >제목 <span class="text-destructive">*</span></Label
                    >
                    <Input
                        id="title"
                        type="text"
                        bind:value={title}
                        placeholder="나눔 제목을 입력하세요"
                        maxlength={200}
                        class={errors.title ? 'border-destructive' : ''}
                        disabled={isLoading}
                    />
                    {#if errors.title}
                        <p class="text-destructive text-sm">{errors.title}</p>
                    {/if}
                    <p class="text-muted-foreground text-xs">{title.length}/200</p>
                </div>

                <!-- 내용 (WYSIWYG) -->
                <div class="space-y-2">
                    <Label for="content" class="text-sm"
                        >내용 <span class="text-destructive">*</span></Label
                    >
                    <TiptapEditor
                        {content}
                        placeholder="나눔 상품에 대한 설명을 작성해주세요..."
                        disabled={isLoading}
                        onUpdate={(html) => (content = html)}
                        class={errors.content ? 'border-destructive' : ''}
                    />
                    {#if errors.content}
                        <p class="text-destructive text-sm">{errors.content}</p>
                    {/if}
                </div>

                <!-- 태그 -->
                <div class="space-y-2">
                    <Label class="text-sm">태그</Label>
                    <TagInput {tags} onchange={(t) => (tags = t)} disabled={isLoading} />
                </div>

                <!-- 이미지 업로드 -->
                <div class="space-y-2">
                    <Label class="text-sm">이미지 첨부</Label>
                    <ImageUploader
                        {boardId}
                        maxFiles={10}
                        maxSizeMB={10}
                        onUpload={handleImageUpload}
                        onRemove={handleImageRemove}
                    />
                </div>

                <!-- 파일 첨부 -->
                <div class="space-y-2">
                    <Label class="text-sm">파일 첨부</Label>
                    <FileUploader
                        {boardId}
                        maxFiles={5}
                        maxSizeMB={50}
                        onUpload={handleFileUpload}
                        onRemove={handleFileRemove}
                    />
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
                            나눔 등록하기
                        {/if}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
</div>
