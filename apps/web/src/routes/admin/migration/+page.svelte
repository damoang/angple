<script lang="ts">
    /**
     * 마이그레이션 마법사
     *
     * 단계별 위자드:
     * 1. 소스 선택 (그누보드 / 라이믹스)
     * 2. DB 연결 설정
     * 3. 사전 분석 (미리보기)
     * 4. 마이그레이션 실행
     * 5. 결과 확인
     */

    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Badge } from '$lib/components/ui/badge';
    import { Switch } from '$lib/components/ui/switch';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import {
        Database,
        ArrowRight,
        ArrowLeft,
        Loader2,
        CheckCircle,
        AlertTriangle,
        XCircle,
        Server,
        Users,
        FileText,
        MessageSquare,
        Paperclip,
        Coins
    } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';

    type MigrationSource = 'gnuboard' | 'rhymix';
    type WizardStep = 'source' | 'connection' | 'analyze' | 'running' | 'result';

    interface TableAnalysis {
        sourceTable: string;
        targetTable: string;
        rowCount: number;
        hasData: boolean;
    }

    interface AnalysisResult {
        source: MigrationSource;
        version?: string;
        tables: TableAnalysis[];
        totalRows: number;
        estimatedTime: string;
        warnings: string[];
    }

    interface MigrationProgress {
        phase: string;
        current: number;
        total: number;
        message: string;
        percent: number;
    }

    interface MigrationResult {
        success: boolean;
        duration: number;
        stats: Record<string, { total: number; migrated: number; skipped: number }>;
        errors: Array<{ phase: string; message: string; detail?: string }>;
    }

    // 상태
    let step = $state<WizardStep>('source');
    let source = $state<MigrationSource>('gnuboard');
    let loading = $state(false);
    let analysis = $state<AnalysisResult | null>(null);
    let progress = $state<MigrationProgress | null>(null);
    let result = $state<MigrationResult | null>(null);

    // DB 연결 설정
    let sourceHost = $state('localhost');
    let sourcePort = $state('3306');
    let sourceUser = $state('root');
    let sourcePassword = $state('');
    let sourceDatabase = $state('');
    let tablePrefix = $state('g5_');

    let targetHost = $state('localhost');
    let targetPort = $state('3306');
    let targetUser = $state('root');
    let targetPassword = $state('');
    let targetDatabase = $state('angple');

    // 옵션
    let migrateAttachments = $state(false);
    let attachmentPath = $state('');
    let keepPhpPasswords = $state(true);
    let dryRun = $state(true);

    // 소스 변경 시 접두사 자동 설정
    $effect(() => {
        tablePrefix = source === 'gnuboard' ? 'g5_' : 'xe_';
    });

    /** 사전 분석 실행 */
    async function runAnalysis() {
        loading = true;
        try {
            const response = await fetch('/api/admin/migration/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    source,
                    host: sourceHost,
                    port: parseInt(sourcePort),
                    user: sourceUser,
                    password: sourcePassword,
                    database: sourceDatabase,
                    tablePrefix
                })
            });

            const data = await response.json();

            if (data.success) {
                analysis = data.analysis;
                step = 'analyze';
            } else {
                toast.error(data.error || 'DB 연결에 실패했습니다.');
            }
        } catch {
            toast.error('서버와 연결할 수 없습니다.');
        } finally {
            loading = false;
        }
    }

    /** 마이그레이션 실행 */
    async function runMigration() {
        step = 'running';
        progress = { phase: 'connecting', current: 0, total: 1, message: '시작 중...', percent: 0 };

        try {
            const response = await fetch('/api/admin/migration/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    source,
                    sourceDb: {
                        host: sourceHost,
                        port: parseInt(sourcePort),
                        user: sourceUser,
                        password: sourcePassword,
                        database: sourceDatabase,
                        tablePrefix
                    },
                    targetDb: {
                        host: targetHost,
                        port: parseInt(targetPort),
                        user: targetUser,
                        password: targetPassword,
                        database: targetDatabase
                    },
                    tablePrefix,
                    migrateAttachments,
                    attachmentSourcePath: attachmentPath || undefined,
                    keepPhpPasswords,
                    dryRun
                })
            });

            const data = await response.json();
            result = data.result;
            step = 'result';

            if (data.result?.success) {
                toast.success('마이그레이션이 완료되었습니다!');
            } else {
                toast.error('마이그레이션 중 일부 오류가 발생했습니다.');
            }
        } catch {
            toast.error('마이그레이션 실행 중 오류가 발생했습니다.');
            step = 'analyze';
        }
    }

    function formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}초`;
        const minutes = Math.floor(seconds / 60);
        const remainSeconds = seconds % 60;
        return `${minutes}분 ${remainSeconds}초`;
    }

    const stepIndex = $derived(
        ['source', 'connection', 'analyze', 'running', 'result'].indexOf(step)
    );
</script>

<div class="container mx-auto max-w-4xl p-8">
    <!-- 헤더 -->
    <div class="mb-8">
        <h1 class="text-4xl font-bold">데이터 마이그레이션</h1>
        <p class="text-muted-foreground mt-2">
            기존 커뮤니티 데이터를 Angple로 안전하게 이전합니다.
        </p>
    </div>

    <!-- 단계 표시기 -->
    <div class="mb-8 flex items-center gap-2">
        {#each ['소스 선택', 'DB 연결', '분석', '실행', '결과'] as label, i (label)}
            <div class="flex items-center gap-2">
                <div
                    class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
                    {i <= stepIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'}"
                >
                    {i + 1}
                </div>
                <span class="text-sm {i <= stepIndex ? 'font-medium' : 'text-muted-foreground'}">
                    {label}
                </span>
                {#if i < 4}
                    <div class="mx-2 h-px w-8 {i < stepIndex ? 'bg-primary' : 'bg-muted'}"></div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Step 1: 소스 선택 -->
    {#if step === 'source'}
        <div class="grid gap-4 md:grid-cols-2">
            <Card
                class="cursor-pointer transition-shadow hover:shadow-lg {source === 'gnuboard'
                    ? 'ring-primary ring-2'
                    : ''}"
                onclick={() => (source = 'gnuboard')}
            >
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Database class="h-5 w-5" />
                        그누보드5
                    </CardTitle>
                    <CardDescription>
                        SIR 그누보드5 (g5_member, g5_write_*, g5_board 등)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="text-muted-foreground space-y-1 text-sm">
                        <li>회원 (g5_member) → member</li>
                        <li>게시판 (g5_board) → board</li>
                        <li>게시글 (g5_write_*) → post</li>
                        <li>wr_1~wr_10 → extra_1~extra_10</li>
                        <li>포인트 (g5_point) → point</li>
                        <li>첨부파일 (g5_board_file) → attachment</li>
                    </ul>
                </CardContent>
            </Card>

            <Card
                class="cursor-pointer transition-shadow hover:shadow-lg {source === 'rhymix'
                    ? 'ring-primary ring-2'
                    : ''}"
                onclick={() => (source = 'rhymix')}
            >
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Database class="h-5 w-5" />
                        라이믹스 / XE
                    </CardTitle>
                    <CardDescription>
                        XETOWN 라이믹스 또는 XE (xe_member, xe_documents 등)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="text-muted-foreground space-y-1 text-sm">
                        <li>회원 (xe_member) → member</li>
                        <li>모듈 (xe_modules) → board</li>
                        <li>문서 (xe_documents) → post</li>
                        <li>extra_vars → extra_1~extra_5</li>
                        <li>댓글 (xe_comments) → comment</li>
                        <li>첨부파일 (xe_files) → attachment</li>
                    </ul>
                </CardContent>
            </Card>
        </div>

        <div class="mt-6 flex justify-end">
            <Button onclick={() => (step = 'connection')}>
                다음
                <ArrowRight class="ml-2 h-4 w-4" />
            </Button>
        </div>
    {/if}

    <!-- Step 2: DB 연결 -->
    {#if step === 'connection'}
        <div class="grid gap-6 md:grid-cols-2">
            <!-- 소스 DB -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Server class="h-4 w-4" />
                        소스 DB ({source === 'gnuboard' ? '그누보드' : '라이믹스'})
                    </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div>
                        <Label for="src-host">호스트</Label>
                        <Input id="src-host" bind:value={sourceHost} placeholder="localhost" />
                    </div>
                    <div>
                        <Label for="src-port">포트</Label>
                        <Input id="src-port" bind:value={sourcePort} placeholder="3306" />
                    </div>
                    <div>
                        <Label for="src-user">사용자명</Label>
                        <Input id="src-user" bind:value={sourceUser} placeholder="root" />
                    </div>
                    <div>
                        <Label for="src-pass">비밀번호</Label>
                        <Input
                            id="src-pass"
                            type="password"
                            bind:value={sourcePassword}
                            placeholder="비밀번호"
                        />
                    </div>
                    <div>
                        <Label for="src-db">데이터베이스</Label>
                        <Input
                            id="src-db"
                            bind:value={sourceDatabase}
                            placeholder={source === 'gnuboard' ? 'gnuboard5' : 'rhymix'}
                        />
                    </div>
                    <div>
                        <Label for="prefix">테이블 접두사</Label>
                        <Input id="prefix" bind:value={tablePrefix} placeholder="g5_" />
                    </div>
                </CardContent>
            </Card>

            <!-- 대상 DB -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Server class="h-4 w-4" />
                        대상 DB (Angple)
                    </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div>
                        <Label for="tgt-host">호스트</Label>
                        <Input id="tgt-host" bind:value={targetHost} placeholder="localhost" />
                    </div>
                    <div>
                        <Label for="tgt-port">포트</Label>
                        <Input id="tgt-port" bind:value={targetPort} placeholder="3306" />
                    </div>
                    <div>
                        <Label for="tgt-user">사용자명</Label>
                        <Input id="tgt-user" bind:value={targetUser} placeholder="root" />
                    </div>
                    <div>
                        <Label for="tgt-pass">비밀번호</Label>
                        <Input
                            id="tgt-pass"
                            type="password"
                            bind:value={targetPassword}
                            placeholder="비밀번호"
                        />
                    </div>
                    <div>
                        <Label for="tgt-db">데이터베이스</Label>
                        <Input id="tgt-db" bind:value={targetDatabase} placeholder="angple" />
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 옵션 -->
        <Card class="mt-6">
            <CardHeader>
                <CardTitle>마이그레이션 옵션</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium">PHP 비밀번호 호환</p>
                        <p class="text-muted-foreground text-sm">
                            bcrypt 해시를 변환하여 기존 비밀번호로 로그인 가능
                        </p>
                    </div>
                    <Switch bind:checked={keepPhpPasswords} />
                </div>
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium">첨부파일 마이그레이션</p>
                        <p class="text-muted-foreground text-sm">
                            업로드된 파일을 Angple 저장소로 복사
                        </p>
                    </div>
                    <Switch bind:checked={migrateAttachments} />
                </div>
                {#if migrateAttachments}
                    <div>
                        <Label for="attach-path">첨부파일 소스 경로</Label>
                        <Input
                            id="attach-path"
                            bind:value={attachmentPath}
                            placeholder={source === 'gnuboard'
                                ? '/path/to/g5_data/file'
                                : '/path/to/files'}
                        />
                    </div>
                {/if}
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium">시뮬레이션 모드 (Dry Run)</p>
                        <p class="text-muted-foreground text-sm">
                            실제 데이터를 쓰지 않고 마이그레이션을 시뮬레이션합니다
                        </p>
                    </div>
                    <Switch bind:checked={dryRun} />
                </div>
                {#if !dryRun}
                    <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                        <AlertTriangle class="mb-1 inline h-4 w-4" />
                        실제 모드: 대상 DB에 데이터가 기록됩니다. 백업을 먼저 수행하세요.
                    </div>
                {/if}
            </CardContent>
        </Card>

        <div class="mt-6 flex justify-between">
            <Button variant="outline" onclick={() => (step = 'source')}>
                <ArrowLeft class="mr-2 h-4 w-4" />
                이전
            </Button>
            <Button onclick={runAnalysis} disabled={loading || !sourceDatabase}>
                {#if loading}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    분석 중...
                {:else}
                    분석 시작
                    <ArrowRight class="ml-2 h-4 w-4" />
                {/if}
            </Button>
        </div>
    {/if}

    <!-- Step 3: 분석 결과 -->
    {#if step === 'analyze' && analysis}
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <CheckCircle class="h-5 w-5 text-green-500" />
                    사전 분석 완료
                </CardTitle>
                <CardDescription>
                    {analysis.source === 'gnuboard' ? '그누보드' : '라이믹스'}
                    {analysis.version ? ` (${analysis.version})` : ''} — 총 {analysis.totalRows.toLocaleString()}개
                    레코드, 예상 소요시간: {analysis.estimatedTime}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <!-- 테이블별 분석 -->
                <div class="space-y-2">
                    {#each analysis.tables as table (table.sourceTable)}
                        <div
                            class="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800"
                        >
                            <div class="flex items-center gap-2">
                                <Badge variant={table.hasData ? 'default' : 'secondary'}>
                                    {table.hasData ? '데이터 있음' : '비어있음'}
                                </Badge>
                                <span class="text-sm font-medium">{table.sourceTable}</span>
                                <span class="text-muted-foreground text-sm">→</span>
                                <span class="text-sm">{table.targetTable}</span>
                            </div>
                            <span class="font-mono text-sm">
                                {table.rowCount.toLocaleString()}행
                            </span>
                        </div>
                    {/each}
                </div>

                <!-- 경고 -->
                {#if analysis.warnings.length > 0}
                    <div class="mt-4 space-y-2">
                        {#each analysis.warnings as warning (warning)}
                            <div
                                class="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
                            >
                                <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0" />
                                {warning}
                            </div>
                        {/each}
                    </div>
                {/if}

                {#if dryRun}
                    <div
                        class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                    >
                        시뮬레이션 모드로 실행됩니다. 실제 데이터는 기록되지 않습니다.
                    </div>
                {/if}
            </CardContent>
        </Card>

        <div class="mt-6 flex justify-between">
            <Button variant="outline" onclick={() => (step = 'connection')}>
                <ArrowLeft class="mr-2 h-4 w-4" />
                설정 변경
            </Button>
            <Button onclick={runMigration}>
                {dryRun ? '시뮬레이션 실행' : '마이그레이션 실행'}
                <ArrowRight class="ml-2 h-4 w-4" />
            </Button>
        </div>
    {/if}

    <!-- Step 4: 실행 중 -->
    {#if step === 'running'}
        <Card>
            <CardContent class="py-12 text-center">
                <Loader2 class="text-primary mx-auto mb-4 h-12 w-12 animate-spin" />
                <h2 class="mb-2 text-xl font-semibold">
                    {dryRun ? '시뮬레이션' : '마이그레이션'} 진행 중...
                </h2>
                {#if progress}
                    <p class="text-muted-foreground mb-4">{progress.message}</p>
                    <div class="bg-muted mx-auto h-2 w-64 overflow-hidden rounded-full">
                        <div
                            class="bg-primary h-full rounded-full transition-all"
                            style="width: {progress.percent}%"
                        ></div>
                    </div>
                    <p class="text-muted-foreground mt-2 text-sm">{progress.percent}%</p>
                {/if}
            </CardContent>
        </Card>
    {/if}

    <!-- Step 5: 결과 -->
    {#if step === 'result' && result}
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    {#if result.success}
                        <CheckCircle class="h-5 w-5 text-green-500" />
                        마이그레이션 완료
                    {:else}
                        <AlertTriangle class="h-5 w-5 text-yellow-500" />
                        마이그레이션 완료 (일부 오류)
                    {/if}
                </CardTitle>
                <CardDescription>
                    소요 시간: {formatDuration(result.duration)}
                    {#if dryRun}
                        <Badge variant="outline" class="ml-2">시뮬레이션</Badge>
                    {/if}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <!-- 통계 -->
                <div class="grid gap-4 md:grid-cols-3">
                    {#each Object.entries(result.stats) as [key, stat] (key)}
                        {@const icons = {
                            members: Users,
                            boards: Database,
                            boardGroups: Database,
                            posts: FileText,
                            comments: MessageSquare,
                            points: Coins,
                            attachments: Paperclip
                        }}
                        {@const labels = {
                            members: '회원',
                            boards: '게시판',
                            boardGroups: '게시판 그룹',
                            posts: '게시글',
                            comments: '댓글',
                            points: '포인트',
                            attachments: '첨부파일'
                        }}
                        {@const Icon = icons[key as keyof typeof icons] || Database}
                        <div class="rounded-md border p-4">
                            <div class="flex items-center gap-2">
                                <Icon class="text-muted-foreground h-4 w-4" />
                                <span class="font-medium"
                                    >{labels[key as keyof typeof labels] || key}</span
                                >
                            </div>
                            <div class="mt-2 space-y-1 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">전체</span>
                                    <span>{stat.total.toLocaleString()}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-green-600">성공</span>
                                    <span>{stat.migrated.toLocaleString()}</span>
                                </div>
                                {#if stat.skipped > 0}
                                    <div class="flex justify-between">
                                        <span class="text-yellow-600">건너뜀</span>
                                        <span>{stat.skipped.toLocaleString()}</span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- 에러 목록 -->
                {#if result.errors.length > 0}
                    <div class="mt-6">
                        <h3 class="mb-2 font-medium text-red-600">
                            오류 ({result.errors.length}건)
                        </h3>
                        <div class="max-h-60 space-y-2 overflow-y-auto">
                            {#each result.errors.slice(0, 50) as error (error.message)}
                                <div
                                    class="flex items-start gap-2 rounded-md bg-red-50 p-2 text-sm dark:bg-red-900/20"
                                >
                                    <XCircle class="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                                    <div>
                                        <p>{error.message}</p>
                                        {#if error.detail}
                                            <p class="text-muted-foreground text-xs">
                                                {error.detail}
                                            </p>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                            {#if result.errors.length > 50}
                                <p class="text-muted-foreground text-sm">
                                    ... 외 {result.errors.length - 50}건
                                </p>
                            {/if}
                        </div>
                    </div>
                {/if}
            </CardContent>
        </Card>

        <div class="mt-6 flex justify-between">
            <Button
                variant="outline"
                onclick={() => {
                    step = 'source';
                    result = null;
                    analysis = null;
                }}
            >
                처음부터 다시
            </Button>
            <Button href="/admin/dashboard">대시보드로 이동</Button>
        </div>
    {/if}
</div>
