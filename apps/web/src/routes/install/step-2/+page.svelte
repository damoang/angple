<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Database, CheckCircle, XCircle, Loader2 } from '@lucide/svelte/icons';

    /**
     * 설치 위저드 Step 2: 데이터베이스 설정
     */

    let { form } = $props();
    let isSubmitting = $state(false);
    let isTesting = $state(false);
    let testResult = $state<'success' | 'error' | null>(null);
    let testMessage = $state('');

    // 폼 데이터
    let dbHost = $state('localhost');
    let dbPort = $state('3306');
    let dbName = $state('angple');
    let dbUser = $state('root');
    let dbPassword = $state('');

    /**
     * DB 연결 테스트
     */
    async function testConnection() {
        isTesting = true;
        testResult = null;
        testMessage = '';

        try {
            const response = await fetch('/api/install/test-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: dbHost,
                    port: parseInt(dbPort),
                    database: dbName,
                    user: dbUser,
                    password: dbPassword
                })
            });

            const result = await response.json();

            if (result.success) {
                testResult = 'success';
                testMessage = '데이터베이스 연결 성공!';
            } else {
                testResult = 'error';
                testMessage = result.error || '연결 실패';
            }
        } catch (error) {
            testResult = 'error';
            testMessage = '연결 테스트 중 오류가 발생했습니다.';
        } finally {
            isTesting = false;
        }
    }
</script>

<svelte:head>
    <title>Angple 설치 - Step 2</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <div class="mb-4 text-4xl font-bold">Angple</div>
            <CardTitle class="text-2xl flex items-center justify-center gap-2">
                <Database class="h-6 w-6" />
                데이터베이스 설정
            </CardTitle>
            <CardDescription>
                MySQL/MariaDB 데이터베이스 연결 정보를 입력하세요.
            </CardDescription>
        </CardHeader>

        <CardContent>
            <!-- 진행 상태 표시 (4단계) -->
            <div class="mb-8 flex items-center justify-center gap-2">
                <div class="bg-primary/50 text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    1
                </div>
                <div class="bg-primary h-0.5 w-8"></div>
                <div class="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    2
                </div>
                <div class="bg-muted-foreground/30 h-0.5 w-8"></div>
                <div class="bg-muted-foreground/30 text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    3
                </div>
                <div class="bg-muted-foreground/30 h-0.5 w-8"></div>
                <div class="bg-muted-foreground/30 text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    4
                </div>
            </div>

            {#if form?.error}
                <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                    {form.error}
                </div>
            {/if}

            <form
                method="POST"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                    };
                }}
            >
                <div class="space-y-4">
                    <div class="grid grid-cols-3 gap-4">
                        <div class="col-span-2 space-y-2">
                            <Label for="dbHost">호스트 *</Label>
                            <Input
                                id="dbHost"
                                name="dbHost"
                                bind:value={dbHost}
                                placeholder="localhost"
                                required
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="dbPort">포트 *</Label>
                            <Input
                                id="dbPort"
                                name="dbPort"
                                bind:value={dbPort}
                                placeholder="3306"
                                required
                            />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="dbName">데이터베이스 이름 *</Label>
                        <Input
                            id="dbName"
                            name="dbName"
                            bind:value={dbName}
                            placeholder="angple"
                            required
                        />
                        <p class="text-muted-foreground text-sm">
                            데이터베이스가 이미 존재해야 합니다.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label for="dbUser">사용자 이름 *</Label>
                        <Input
                            id="dbUser"
                            name="dbUser"
                            bind:value={dbUser}
                            placeholder="root"
                            required
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="dbPassword">비밀번호</Label>
                        <Input
                            id="dbPassword"
                            name="dbPassword"
                            type="password"
                            bind:value={dbPassword}
                            placeholder="비밀번호 입력"
                        />
                    </div>

                    <!-- 연결 테스트 -->
                    <div class="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            class="w-full"
                            onclick={testConnection}
                            disabled={isTesting}
                        >
                            {#if isTesting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                연결 테스트 중...
                            {:else}
                                연결 테스트
                            {/if}
                        </Button>

                        {#if testResult}
                            <div class="mt-3 flex items-center gap-2 rounded-md p-3 text-sm {testResult === 'success' ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}">
                                {#if testResult === 'success'}
                                    <CheckCircle class="h-4 w-4" />
                                {:else}
                                    <XCircle class="h-4 w-4" />
                                {/if}
                                {testMessage}
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="mt-8 flex justify-between">
                    <Button type="button" variant="outline" href="/install">
                        이전
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '처리 중...' : '다음 단계'}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
</div>
