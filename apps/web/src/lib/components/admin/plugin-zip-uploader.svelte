<script lang="ts">
    import { Upload, Loader2, CheckCircle, AlertCircle } from '@lucide/svelte';
    import { Button } from '$lib/components/ui/button';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle
    } from '$lib/components/ui/dialog';
    import { toast } from 'svelte-sonner';
    import { t } from '$lib/i18n';

    type UploadStep = 'idle' | 'uploading' | 'success' | 'error';

    interface Props {
        onUploadSuccess?: () => void;
    }

    let { onUploadSuccess }: Props = $props();

    let dialogOpen = $state(false);
    let step = $state<UploadStep>('idle');
    let errorMessage = $state('');
    let uploadedPluginName = $state('');
    let fileInput = $state<HTMLInputElement | null>(null);

    function openDialog() {
        step = 'idle';
        errorMessage = '';
        uploadedPluginName = '';
        dialogOpen = true;
    }

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            toast.error('ZIP 파일만 업로드 가능합니다.');
            return;
        }

        step = 'uploading';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/plugins/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                step = 'success';
                uploadedPluginName = result.manifest?.name || result.pluginId;
                toast.success(result.message);
                onUploadSuccess?.();
            } else {
                step = 'error';
                errorMessage = result.error || '업로드 실패';
                toast.error(result.error);
            }
        } catch (err) {
            step = 'error';
            errorMessage = err instanceof Error ? err.message : '업로드 중 오류 발생';
            toast.error(errorMessage);
        }

        // 파일 입력 초기화
        if (input) input.value = '';
    }

    function closeDialog() {
        dialogOpen = false;
        step = 'idle';
    }
</script>

<Button variant="outline" onclick={openDialog}>
    <Upload class="mr-2 h-4 w-4" />
    {t('admin_plugins_upload')}
</Button>

<Dialog bind:open={dialogOpen}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>플러그인 ZIP 업로드</DialogTitle>
            <DialogDescription>
                plugin.json 또는 extension.json이 포함된 ZIP 파일을 업로드하세요.
            </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
            {#if step === 'idle'}
                <div
                    class="border-muted-foreground/25 hover:border-primary/50 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors"
                    role="button"
                    tabindex="0"
                    onclick={() => fileInput?.click()}
                    onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
                >
                    <Upload class="text-muted-foreground h-10 w-10" />
                    <p class="text-muted-foreground text-sm">클릭하여 ZIP 파일 선택</p>
                    <p class="text-muted-foreground text-xs">최대 20MB</p>
                </div>
                <input
                    bind:this={fileInput}
                    type="file"
                    accept=".zip"
                    class="hidden"
                    onchange={handleFileChange}
                />
            {:else if step === 'uploading'}
                <div class="flex flex-col items-center gap-3 py-8">
                    <Loader2 class="text-primary h-10 w-10 animate-spin" />
                    <p class="text-sm font-medium">업로드 중...</p>
                </div>
            {:else if step === 'success'}
                <div class="flex flex-col items-center gap-3 py-8">
                    <CheckCircle class="h-10 w-10 text-green-500" />
                    <p class="text-sm font-medium">"{uploadedPluginName}" 업로드 완료</p>
                    <Button variant="outline" size="sm" onclick={closeDialog}>닫기</Button>
                </div>
            {:else if step === 'error'}
                <div class="flex flex-col items-center gap-3 py-8">
                    <AlertCircle class="h-10 w-10 text-red-500" />
                    <p class="text-sm font-medium text-red-600">{errorMessage}</p>
                    <Button variant="outline" size="sm" onclick={openDialog}>다시 시도</Button>
                </div>
            {/if}
        </div>
    </DialogContent>
</Dialog>
