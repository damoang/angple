<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { apiClient } from '$lib/api/index.js';
    import type { UploadedFile } from '$lib/api/types.js';
    import FileUp from '@lucide/svelte/icons/file-up';
    import FileIcon from '@lucide/svelte/icons/file';
    import FileImage from '@lucide/svelte/icons/file-image';
    import FileVideo from '@lucide/svelte/icons/file-video';
    import FileAudio from '@lucide/svelte/icons/file-audio';
    import FileText from '@lucide/svelte/icons/file-text';
    import FileArchive from '@lucide/svelte/icons/file-archive';
    import X from '@lucide/svelte/icons/x';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import AlertCircle from '@lucide/svelte/icons/alert-circle';
    import Download from '@lucide/svelte/icons/download';

    interface Props {
        boardId?: string;
        postId?: number;
        maxFiles?: number;
        maxSizeMB?: number;
        allowedExtensions?: string[];
        onUpload?: (file: UploadedFile) => void;
        onRemove?: (fileId: string) => void;
        class?: string;
    }

    let {
        boardId = 'free',
        postId,
        maxFiles = 5,
        maxSizeMB = 50,
        allowedExtensions = [],
        onUpload,
        onRemove,
        class: className = ''
    }: Props = $props();

    // 업로드된 파일 목록
    let uploadedFiles = $state<UploadedFile[]>([]);

    // 업로드 중인 파일
    interface UploadingFile {
        id: string;
        file: File;
        progress: number;
        error?: string;
    }
    let uploadingFiles = $state<UploadingFile[]>([]);

    // 드래그 상태
    let isDragging = $state(false);

    // 파일 입력 ref
    let fileInput: HTMLInputElement;

    const MAX_SIZE_BYTES = maxSizeMB * 1024 * 1024;

    // 파일 유효성 검사
    function validateFile(file: File): string | null {
        if (file.size > MAX_SIZE_BYTES) {
            return `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`;
        }
        if (uploadedFiles.length + uploadingFiles.length >= maxFiles) {
            return `최대 ${maxFiles}개의 파일만 첨부할 수 있습니다.`;
        }
        if (allowedExtensions.length > 0) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            if (!allowedExtensions.includes(ext)) {
                return `허용되지 않는 파일 형식입니다. (${allowedExtensions.join(', ')} 가능)`;
            }
        }
        return null;
    }

    // 파일 아이콘 선택
    function getFileIcon(mimeType: string): typeof FileIcon {
        if (mimeType.startsWith('image/')) return FileImage;
        if (mimeType.startsWith('video/')) return FileVideo;
        if (mimeType.startsWith('audio/')) return FileAudio;
        if (
            mimeType.startsWith('text/') ||
            mimeType.includes('pdf') ||
            mimeType.includes('document')
        )
            return FileText;
        if (
            mimeType.includes('zip') ||
            mimeType.includes('rar') ||
            mimeType.includes('archive') ||
            mimeType.includes('compressed')
        )
            return FileArchive;
        return FileIcon;
    }

    // 파일 크기 포맷
    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // 파일 업로드 처리
    async function handleFiles(files: FileList | File[]): Promise<void> {
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            const error = validateFile(file);
            if (error) {
                const uploadingFile: UploadingFile = {
                    id: crypto.randomUUID(),
                    file,
                    progress: 0,
                    error
                };
                uploadingFiles = [...uploadingFiles, uploadingFile];
                continue;
            }

            const uploadingFile: UploadingFile = {
                id: crypto.randomUUID(),
                file,
                progress: 0
            };
            uploadingFiles = [...uploadingFiles, uploadingFile];

            try {
                const uploaded = await apiClient.uploadFile(boardId, file, postId);
                uploadingFiles = uploadingFiles.filter((f) => f.id !== uploadingFile.id);
                uploadedFiles = [...uploadedFiles, uploaded];
                onUpload?.(uploaded);
            } catch (err) {
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
            target.value = '';
        }
    }

    // 업로드 중인 파일 제거
    function removeUploadingFile(id: string): void {
        uploadingFiles = uploadingFiles.filter((f) => f.id !== id);
    }

    // 업로드된 파일 제거
    function removeUploadedFile(id: string): void {
        uploadedFiles = uploadedFiles.filter((f) => f.id !== id);
        onRemove?.(id);
    }

    // 전체 파일 수
    const totalFiles = $derived(uploadedFiles.length + uploadingFiles.length);
    const canUploadMore = $derived(totalFiles < maxFiles);

    // 업로드된 파일 목록 반환
    export function getUploadedFiles(): UploadedFile[] {
        return uploadedFiles;
    }

    // 파일 목록 초기화
    export function reset(): void {
        uploadedFiles = [];
        uploadingFiles = [];
    }
</script>

<div class="file-uploader {className}">
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
            <FileUp class="text-muted-foreground mb-2 h-8 w-8" />
            <p class="text-foreground text-sm font-medium">클릭하거나 파일을 드래그하세요</p>
            <p class="text-muted-foreground mt-1 text-xs">
                최대 {maxSizeMB}MB, {maxFiles}개까지
                {#if allowedExtensions.length > 0}
                    ({allowedExtensions.join(', ')})
                {/if}
            </p>
        </div>
    {/if}

    <!-- 숨겨진 파일 입력 -->
    <input type="file" multiple bind:this={fileInput} onchange={handleFileSelect} class="hidden" />

    <!-- 파일 목록 -->
    {#if totalFiles > 0}
        <div class="space-y-2">
            <!-- 업로드 완료된 파일 -->
            {#each uploadedFiles as file (file.id)}
                {@const FileIcon = getFileIcon(file.mime_type)}
                <div class="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                    <FileIcon class="text-muted-foreground h-8 w-8 shrink-0" />
                    <div class="min-w-0 flex-1">
                        <p class="text-foreground truncate text-sm font-medium">
                            {file.original_filename}
                        </p>
                        <p class="text-muted-foreground text-xs">
                            {formatFileSize(file.size)}
                        </p>
                    </div>
                    <div class="flex items-center gap-1">
                        <a
                            href={file.url}
                            download={file.original_filename}
                            class="text-muted-foreground hover:text-foreground p-1"
                            title="다운로드"
                        >
                            <Download class="h-4 w-4" />
                        </a>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onclick={() => removeUploadedFile(file.id)}
                            class="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                        >
                            <X class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            {/each}

            <!-- 업로드 중인 파일 -->
            {#each uploadingFiles as uploading (uploading.id)}
                <div
                    class="bg-muted/50 flex items-center gap-3 rounded-lg p-3 {uploading.error
                        ? 'border-destructive border'
                        : ''}"
                >
                    {#if uploading.error}
                        <AlertCircle class="text-destructive h-8 w-8 shrink-0" />
                    {:else}
                        <Loader2 class="text-primary h-8 w-8 shrink-0 animate-spin" />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p class="text-foreground truncate text-sm font-medium">
                            {uploading.file.name}
                        </p>
                        {#if uploading.error}
                            <p class="text-destructive text-xs">{uploading.error}</p>
                        {:else}
                            <p class="text-muted-foreground text-xs">업로드 중...</p>
                        {/if}
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onclick={() => removeUploadingFile(uploading.id)}
                        class="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                    >
                        <X class="h-4 w-4" />
                    </Button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- 업로드 현황 -->
    {#if totalFiles > 0}
        <p class="text-muted-foreground mt-3 text-sm">
            {uploadedFiles.length}개 첨부됨
            {#if uploadingFiles.filter((f) => !f.error).length > 0}
                / {uploadingFiles.filter((f) => !f.error).length}개 업로드 중
            {/if}
            (최대 {maxFiles}개)
        </p>
    {/if}
</div>
