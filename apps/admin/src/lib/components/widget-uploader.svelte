<script lang="ts">
    import { Upload, X, FileArchive, CheckCircle, AlertCircle, Package } from '@lucide/svelte';
    import { Button } from '$lib/components/ui/button';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle
    } from '$lib/components/ui/dialog';
    import { toast } from 'svelte-sonner';

    /** 업로드 상태 */
    type UploadState = 'idle' | 'uploading' | 'success' | 'error';

    /** Props */
    let { onUploadSuccess = () => {} }: { onUploadSuccess?: () => void } = $props();

    /** 상태 */
    let dialogOpen = $state(false);
    let uploadState = $state<UploadState>('idle');
    let selectedFile = $state<File | null>(null);
    let uploadProgress = $state(0);
    let errorMessage = $state<string | null>(null);
    let isDragging = $state(false);

    /** 파일 선택 input ref */
    let fileInput: HTMLInputElement;

    /** 파일 선택 핸들러 */
    function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (file) {
            validateAndSetFile(file);
        }
    }

    /** 드래그 앤 드롭 핸들러 */
    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        isDragging = true;
    }

    function handleDragLeave(event: DragEvent) {
        event.preventDefault();
        isDragging = false;
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        isDragging = false;

        const file = event.dataTransfer?.files[0];
        if (file) {
            validateAndSetFile(file);
        }
    }

    /** 파일 검증 및 설정 */
    function validateAndSetFile(file: File) {
        // ZIP 파일 검증
        if (!file.name.endsWith('.zip')) {
            toast.error('ZIP 파일만 업로드 가능합니다.');
            return;
        }

        // 파일 크기 검증 (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('파일 크기는 10MB를 초과할 수 없습니다.');
            return;
        }

        selectedFile = file;
        uploadState = 'idle';
        errorMessage = null;
    }

    /** 파일 제거 */
    function removeFile() {
        selectedFile = null;
        uploadState = 'idle';
        errorMessage = null;
        uploadProgress = 0;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    /** 업로드 실행 */
    async function uploadWidget() {
        if (!selectedFile) return;

        uploadState = 'uploading';
        uploadProgress = 0;
        errorMessage = null;

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            // XMLHttpRequest로 진행률 추적
            const xhr = new XMLHttpRequest();

            // 진행률 이벤트
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    uploadProgress = Math.round((event.loaded / event.total) * 100);
                }
            });

            // 완료 이벤트
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);

                    if (response.success) {
                        uploadState = 'success';
                        toast.success(
                            `위젯 "${response.manifest.name}"가 성공적으로 업로드되었습니다.`
                        );

                        // 2초 후 다이얼로그 닫기 및 콜백 호출
                        setTimeout(() => {
                            dialogOpen = false;
                            removeFile();
                            onUploadSuccess();
                        }, 2000);
                    } else {
                        uploadState = 'error';
                        errorMessage = response.error || '업로드 중 오류가 발생했습니다.';
                        toast.error(errorMessage!);
                    }
                } else {
                    const response = JSON.parse(xhr.responseText);
                    uploadState = 'error';
                    errorMessage = response.error || `서버 오류 (${xhr.status})`;
                    toast.error(errorMessage!);
                }
            });

            // 에러 이벤트
            xhr.addEventListener('error', () => {
                uploadState = 'error';
                errorMessage = '네트워크 오류가 발생했습니다.';
                toast.error(errorMessage!);
            });

            // 업로드 시작 (Web 앱의 위젯 업로드 API)
            xhr.open('POST', 'http://localhost:5173/api/widgets/upload');
            xhr.send(formData);
        } catch (error) {
            uploadState = 'error';
            errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            toast.error(errorMessage!);
        }
    }
</script>

<Button onclick={() => (dialogOpen = true)}>
    <Upload class="mr-2 h-4 w-4" />
    새 위젯 업로드
</Button>

<Dialog bind:open={dialogOpen}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>위젯 업로드</DialogTitle>
            <DialogDescription>
                ZIP 형식의 위젯 파일을 업로드하세요. widget.json 파일이 포함되어야 합니다. (최대
                10MB)
            </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
            <!-- 드래그 앤 드롭 영역 -->
            {#if !selectedFile}
                <div
                    class="border-border hover:border-primary flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors {isDragging
                        ? 'border-primary bg-primary bg-opacity-5'
                        : ''}"
                    ondragover={handleDragOver}
                    ondragleave={handleDragLeave}
                    ondrop={handleDrop}
                    onclick={() => fileInput.click()}
                    role="button"
                    tabindex="0"
                >
                    <Package class="text-muted-foreground mb-4 h-12 w-12" />
                    <p class="text-foreground mb-2 text-sm font-medium">
                        클릭하거나 파일을 드래그하여 업로드
                    </p>
                    <p class="text-muted-foreground text-xs">ZIP 파일만 지원 (최대 10MB)</p>
                </div>

                <input
                    type="file"
                    accept=".zip"
                    class="hidden"
                    bind:this={fileInput}
                    onchange={handleFileSelect}
                />
            {:else}
                <!-- 선택된 파일 정보 -->
                <div class="bg-muted rounded-lg p-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <FileArchive class="text-primary h-8 w-8" />
                            <div>
                                <p class="text-foreground font-medium">{selectedFile.name}</p>
                                <p class="text-muted-foreground text-sm">
                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>

                        {#if uploadState === 'idle'}
                            <Button variant="ghost" size="icon" onclick={removeFile}>
                                <X class="h-4 w-4" />
                            </Button>
                        {/if}
                    </div>

                    <!-- 진행률 바 -->
                    {#if uploadState === 'uploading'}
                        <div class="mt-4">
                            <div class="bg-background mb-2 h-2 overflow-hidden rounded-full">
                                <div
                                    class="bg-primary h-full transition-all duration-300"
                                    style="width: {uploadProgress}%"
                                ></div>
                            </div>
                            <p class="text-muted-foreground text-xs">
                                업로드 중... {uploadProgress}%
                            </p>
                        </div>
                    {/if}

                    <!-- 성공 메시지 -->
                    {#if uploadState === 'success'}
                        <div class="mt-4 flex items-center gap-2 text-green-600">
                            <CheckCircle class="h-5 w-5" />
                            <p class="text-sm font-medium">업로드 완료!</p>
                        </div>
                    {/if}

                    <!-- 에러 메시지 -->
                    {#if uploadState === 'error' && errorMessage}
                        <div class="bg-destructive/10 text-destructive mt-4 rounded-md p-3">
                            <div class="flex items-start gap-2">
                                <AlertCircle class="h-5 w-5 flex-shrink-0" />
                                <p class="text-sm">{errorMessage}</p>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- 액션 버튼 -->
                <div class="flex gap-2">
                    <Button
                        variant="outline"
                        class="flex-1"
                        onclick={removeFile}
                        disabled={uploadState === 'uploading'}
                    >
                        취소
                    </Button>
                    <Button
                        class="flex-1"
                        onclick={uploadWidget}
                        disabled={uploadState === 'uploading' || uploadState === 'success'}
                    >
                        {#if uploadState === 'uploading'}
                            업로드 중...
                        {:else if uploadState === 'success'}
                            완료
                        {:else}
                            업로드
                        {/if}
                    </Button>
                </div>
            {/if}
        </div>
    </DialogContent>
</Dialog>
