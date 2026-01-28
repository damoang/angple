<script lang="ts">
    import {
        Github,
        Package,
        Lock,
        Unlock,
        Save,
        CheckCircle,
        AlertCircle,
        Loader2,
        X
    } from '@lucide/svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle
    } from '$lib/components/ui/dialog';
    import { toast } from 'svelte-sonner';
    import { t } from '$lib/i18n';

    /** 설치 단계 */
    type InstallStep = 'input' | 'installing' | 'success' | 'error';

    /** 설치 로그 아이템 */
    interface LogItem {
        status: 'pending' | 'running' | 'done' | 'error';
        message: string;
    }

    /** Props */
    let { onInstallSuccess = () => {} }: { onInstallSuccess?: () => void } = $props();

    /** 상태 */
    let dialogOpen = $state(false);
    let step = $state<InstallStep>('input');

    // 입력 필드
    let packageName = $state('');
    let isPrivate = $state(false);
    let token = $state('');
    let saveToken = $state(false);

    // 설치 로그
    let logs = $state<LogItem[]>([]);
    let errorMessage = $state<string | null>(null);
    let installedPluginName = $state<string | null>(null);

    /** 다이얼로그 열기 */
    function openDialog() {
        resetForm();
        dialogOpen = true;
    }

    /** 폼 리셋 */
    function resetForm() {
        step = 'input';
        packageName = '';
        isPrivate = false;
        token = '';
        saveToken = false;
        logs = [];
        errorMessage = null;
        installedPluginName = null;
    }

    /** 로그 추가/업데이트 */
    function addLog(message: string, status: LogItem['status'] = 'pending') {
        logs = [...logs, { message, status }];
        return logs.length - 1;
    }

    function updateLog(index: number, status: LogItem['status']) {
        logs = logs.map((log, i) => (i === index ? { ...log, status } : log));
    }

    /** 설치 실행 */
    async function installPlugin() {
        if (!packageName.trim()) {
            toast.error('패키지명을 입력해주세요.');
            return;
        }

        if (isPrivate && !token.trim()) {
            toast.error('Private 저장소는 GitHub 토큰이 필요합니다.');
            return;
        }

        step = 'installing';
        logs = [];
        errorMessage = null;

        try {
            // 1. 패키지 정보 확인
            const infoIdx = addLog('패키지 정보 확인 중...', 'running');

            // 2. 설치 API 호출
            const response = await fetch('http://localhost:5173/api/plugins/install-github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packageName: packageName.trim(),
                    isPrivate,
                    token: isPrivate ? token.trim() : undefined,
                    saveToken: saveToken && isPrivate
                })
            });

            updateLog(infoIdx, 'done');

            const downloadIdx = addLog('다운로드 및 설치 중...', 'running');

            const result = await response.json();

            if (result.success) {
                updateLog(downloadIdx, 'done');

                const verifyIdx = addLog('보안 검증 완료', 'done');
                const installIdx = addLog('설치 완료!', 'done');

                installedPluginName = result.manifest?.name || result.pluginId;
                step = 'success';

                toast.success(`플러그인 "${installedPluginName}"가 설치되었습니다.`);

                // 3초 후 다이얼로그 닫기
                setTimeout(() => {
                    dialogOpen = false;
                    onInstallSuccess();
                }, 2000);
            } else {
                updateLog(downloadIdx, 'error');
                errorMessage = result.error || '알 수 없는 오류';
                step = 'error';
                toast.error(errorMessage!);
            }
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : '네트워크 오류';
            step = 'error';
            toast.error(errorMessage!);
        }
    }

    /** 취소 */
    function cancel() {
        if (step === 'installing') {
            // 설치 중에는 취소 불가
            return;
        }
        dialogOpen = false;
    }
</script>

<Button variant="outline" onclick={openDialog}>
    <Github class="mr-2 h-4 w-4" />
    GitHub에서 설치
</Button>

<Dialog bind:open={dialogOpen}>
    <DialogContent class="sm:max-w-lg">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <Github class="h-5 w-5" />
                GitHub에서 플러그인 설치
            </DialogTitle>
            <DialogDescription>GitHub Packages에 등록된 플러그인을 설치합니다.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
            {#if step === 'input'}
                <!-- 패키지명 입력 -->
                <div class="space-y-2">
                    <Label for="packageName">패키지명 또는 GitHub URL</Label>
                    <div class="relative">
                        <Package
                            class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        />
                        <Input
                            id="packageName"
                            bind:value={packageName}
                            placeholder="@damoang/plugin-example"
                            class="pl-10"
                        />
                    </div>
                    <p class="text-muted-foreground text-xs">
                        예: @angple/plugin-xxx, @damoang/plugin-xxx, https://github.com/org/repo
                    </p>
                </div>

                <!-- Private 저장소 체크박스 -->
                <div class="flex items-center space-x-2">
                    <Checkbox id="isPrivate" bind:checked={isPrivate} />
                    <Label for="isPrivate" class="flex cursor-pointer items-center gap-2">
                        {#if isPrivate}
                            <Lock class="h-4 w-4" />
                        {:else}
                            <Unlock class="h-4 w-4" />
                        {/if}
                        Private 저장소
                    </Label>
                </div>

                <!-- Private 저장소일 때 토큰 입력 -->
                {#if isPrivate}
                    <div class="space-y-2">
                        <Label for="token">GitHub Personal Access Token (PAT)</Label>
                        <Input
                            id="token"
                            type="password"
                            bind:value={token}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        />
                        <p class="text-muted-foreground text-xs">
                            read:packages 권한이 필요합니다.
                            <a
                                href="https://github.com/settings/tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-primary underline"
                            >
                                토큰 생성하기
                            </a>
                        </p>
                    </div>

                    <!-- 토큰 저장 체크박스 -->
                    <div class="flex items-center space-x-2">
                        <Checkbox id="saveToken" bind:checked={saveToken} />
                        <Label for="saveToken" class="flex cursor-pointer items-center gap-2">
                            <Save class="h-4 w-4" />
                            토큰 저장 (자동 업데이트용)
                        </Label>
                    </div>
                {/if}
            {:else}
                <!-- 설치 로그 -->
                <div class="bg-muted rounded-lg p-4">
                    <div class="space-y-2">
                        {#each logs as log}
                            <div class="flex items-center gap-2 text-sm">
                                {#if log.status === 'pending'}
                                    <div
                                        class="bg-muted-foreground h-4 w-4 rounded-full opacity-50"
                                    ></div>
                                {:else if log.status === 'running'}
                                    <Loader2 class="text-primary h-4 w-4 animate-spin" />
                                {:else if log.status === 'done'}
                                    <CheckCircle class="h-4 w-4 text-green-500" />
                                {:else if log.status === 'error'}
                                    <AlertCircle class="h-4 w-4 text-red-500" />
                                {/if}
                                <span class:text-muted-foreground={log.status === 'pending'}>
                                    {log.message}
                                </span>
                            </div>
                        {/each}
                    </div>

                    <!-- 에러 메시지 -->
                    {#if step === 'error' && errorMessage}
                        <div class="bg-destructive/10 text-destructive mt-4 rounded-md p-3 text-sm">
                            <div class="flex items-start gap-2">
                                <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        </div>
                    {/if}

                    <!-- 성공 메시지 -->
                    {#if step === 'success'}
                        <div class="mt-4 flex items-center gap-2 text-green-600">
                            <CheckCircle class="h-5 w-5" />
                            <span class="font-medium">
                                "{installedPluginName}" 설치 완료!
                            </span>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- 액션 버튼 -->
        <div class="flex justify-end gap-2">
            <Button variant="outline" onclick={cancel} disabled={step === 'installing'}>
                {step === 'success' ? '닫기' : '취소'}
            </Button>
            {#if step === 'input'}
                <Button onclick={installPlugin}>
                    <Github class="mr-2 h-4 w-4" />
                    설치
                </Button>
            {:else if step === 'error'}
                <Button onclick={() => (step = 'input')}>다시 시도</Button>
            {/if}
        </div>
    </DialogContent>
</Dialog>
