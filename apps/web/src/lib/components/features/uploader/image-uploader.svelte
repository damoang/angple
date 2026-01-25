<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { apiClient } from '$lib/api/index.js';
    import type { UploadedFile } from '$lib/api/types.js';
    import ImagePlus from '@lucide/svelte/icons/image-plus';
    import X from '@lucide/svelte/icons/x';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import AlertCircle from '@lucide/svelte/icons/alert-circle';

    interface Props {
        boardId?: string;
        postId?: number;
        maxFiles?: number;
        maxSizeMB?: number;
        onUpload?: (file: UploadedFile) => void;
        onRemove?: (fileId: string) => void;
        class?: string;
    }

    let {
        boardId = 'free',
        postId,
        maxFiles = 10,
        maxSizeMB = 10,
        onUpload,
        onRemove,
        class: className = ''
    }: Props = $props();

    // 업로드된 이미지 목록
    let uploadedImages = $state<UploadedFile[]>([]);

    // 업로드 중인 파일 (미리보기용)
    interface UploadingFile {
        id: string;
        file: File;
        preview: string;
        progress: number;
        error?: string;
    }
    let uploadingFiles = $state<UploadingFile[]>([]);

    // 드래그 상태
    let isDragging = $state(false);

    // 파일 입력 ref
    let fileInput: HTMLInputElement;

    // 허용된 이미지 타입
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const MAX_SIZE_BYTES = maxSizeMB * 1024 * 1024;

    // 파일 유효성 검사
    function validateFile(file: File): string | null {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return '지원하지 않는 이미지 형식입니다. (JPG, PNG, GIF, WebP만 가능)';
        }
        if (file.size > MAX_SIZE_BYTES) {
            return `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`;
        }
        if (uploadedImages.length + uploadingFiles.length >= maxFiles) {
            return `최대 ${maxFiles}개의 이미지만 업로드할 수 있습니다.`;
        }
        return null;
    }

    // 파일 미리보기 생성
    function createPreview(file: File): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
        });
    }

    // 파일 업로드 처리
    async function handleFiles(files: FileList | File[]): Promise<void> {
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            const error = validateFile(file);
            if (error) {
                // 에러가 있는 파일도 미리보기에 표시 (에러 메시지와 함께)
                const preview = await createPreview(file);
                const uploadingFile: UploadingFile = {
                    id: crypto.randomUUID(),
                    file,
                    preview,
                    progress: 0,
                    error
                };
                uploadingFiles = [...uploadingFiles, uploadingFile];
                continue;
            }

            // 미리보기 생성
            const preview = await createPreview(file);
            const uploadingFile: UploadingFile = {
                id: crypto.randomUUID(),
                file,
                preview,
                progress: 0
            };
            uploadingFiles = [...uploadingFiles, uploadingFile];

            // 업로드 시작
            try {
                const uploaded = await apiClient.uploadImage(boardId, file, postId);

                // 업로드 성공 - uploadingFiles에서 제거하고 uploadedImages에 추가
                uploadingFiles = uploadingFiles.filter((f) => f.id !== uploadingFile.id);
                uploadedImages = [...uploadedImages, uploaded];

                onUpload?.(uploaded);
            } catch (err) {
                // 업로드 실패
                uploadingFiles = uploadingFiles.map((f) =>
                    f.id === uploadingFile.id
                        ? { ...f, error: err instanceof Error ? err.message : '업로드 실패' }
                        : f
                );
            }
        }
    }

    // 드래그 이벤트 핸들러
    function handleDragOver(e: DragEvent): void {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave(e: DragEvent): void {
        e.preventDefault();
        isDragging = false;
    }

    function handleDrop(e: DragEvent): void {
        e.preventDefault();
        isDragging = false;

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
    }

    // 파일 선택 핸들러
    function handleFileSelect(e: Event): void {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            handleFiles(target.files);
            target.value = ''; // 같은 파일 재선택 가능하도록
        }
    }

    // 업로드 중인 파일 제거
    function removeUploadingFile(id: string): void {
        uploadingFiles = uploadingFiles.filter((f) => f.id !== id);
    }

    // 업로드된 이미지 제거
    function removeUploadedImage(id: string): void {
        uploadedImages = uploadedImages.filter((img) => img.id !== id);
        onRemove?.(id);
    }

    // 클립보드에서 이미지 붙여넣기
    function handlePaste(e: ClipboardEvent): void {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            handleFiles(imageFiles);
        }
    }

    // 전체 이미지 수
    const totalImages = $derived(uploadedImages.length + uploadingFiles.length);
    const canUploadMore = $derived(totalImages < maxFiles);

    // 이미지 URL 목록 반환 (에디터 연동용)
    export function getImageUrls(): string[] {
        return uploadedImages.map((img) => img.url);
    }

    // 업로드된 파일 목록 반환
    export function getUploadedFiles(): UploadedFile[] {
        return uploadedImages;
    }

    // 이미지 초기화
    export function reset(): void {
        uploadedImages = [];
        uploadingFiles = [];
    }
</script>

<svelte:window onpaste={handlePaste} />

<div class="image-uploader {className}">
    <!-- 드롭존 -->
    {#if canUploadMore}
        <div
            class="border-border hover:border-primary mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors {isDragging
                ? 'border-primary bg-primary/5'
                : 'bg-muted/30'}"
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onclick={() => fileInput.click()}
            onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
            role="button"
            tabindex="0"
        >
            <ImagePlus class="text-muted-foreground mb-2 h-8 w-8" />
            <p class="text-foreground text-sm font-medium">클릭하거나 이미지를 드래그하세요</p>
            <p class="text-muted-foreground mt-1 text-xs">
                JPG, PNG, GIF, WebP (최대 {maxSizeMB}MB, {maxFiles}개까지)
            </p>
            <p class="text-muted-foreground mt-1 text-xs">Ctrl+V로 클립보드 이미지 붙여넣기 가능</p>
        </div>
    {/if}

    <!-- 숨겨진 파일 입력 -->
    <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        bind:this={fileInput}
        onchange={handleFileSelect}
        class="hidden"
    />

    <!-- 이미지 미리보기 그리드 -->
    {#if totalImages > 0}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <!-- 업로드 완료된 이미지 -->
            {#each uploadedImages as image (image.id)}
                <div class="group relative aspect-square overflow-hidden rounded-lg">
                    <img
                        src={image.thumbnail_url || image.url}
                        alt={image.original_filename}
                        class="h-full w-full object-cover"
                    />
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onclick={() => removeUploadedImage(image.id)}
                            class="h-8 w-8 rounded-full p-0"
                        >
                            <X class="h-4 w-4" />
                        </Button>
                    </div>
                    <div
                        class="bg-background/80 absolute bottom-0 left-0 right-0 truncate px-2 py-1 text-xs"
                    >
                        {image.original_filename}
                    </div>
                </div>
            {/each}

            <!-- 업로드 중인 이미지 -->
            {#each uploadingFiles as uploading (uploading.id)}
                <div class="relative aspect-square overflow-hidden rounded-lg">
                    <img
                        src={uploading.preview}
                        alt="업로드 중..."
                        class="h-full w-full object-cover {uploading.error ? 'opacity-50' : ''}"
                    />

                    {#if uploading.error}
                        <!-- 에러 상태 -->
                        <div
                            class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-2"
                        >
                            <AlertCircle class="mb-1 h-6 w-6 text-red-500" />
                            <p class="text-center text-xs text-red-300">{uploading.error}</p>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onclick={() => removeUploadingFile(uploading.id)}
                                class="mt-2 h-6 text-xs text-white"
                            >
                                제거
                            </Button>
                        </div>
                    {:else}
                        <!-- 업로드 중 -->
                        <div class="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Loader2 class="h-8 w-8 animate-spin text-white" />
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    <!-- 업로드 현황 -->
    {#if totalImages > 0}
        <p class="text-muted-foreground mt-3 text-sm">
            {uploadedImages.length}개 업로드 완료
            {#if uploadingFiles.filter((f) => !f.error).length > 0}
                / {uploadingFiles.filter((f) => !f.error).length}개 업로드 중
            {/if}
            (최대 {maxFiles}개)
        </p>
    {/if}
</div>
