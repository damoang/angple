<script lang="ts">
    /**
     * 이용제한 기록 상세 페이지
     */
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import Calendar from '@lucide/svelte/icons/calendar';
    import User from '@lucide/svelte/icons/user';
    import FileText from '@lucide/svelte/icons/file-text';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import {
        getDisciplineLog,
        getPenaltyDisplay,
        type DisciplineLogDetail
    } from '$lib/api/discipline-log.js';
    import { authStore } from '$lib/stores/auth.svelte.js';

    let log = $state<DisciplineLogDetail | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    const id = $derived(Number(page.params.id));

    async function fetchLog() {
        loading = true;
        error = null;
        try {
            const result = await getDisciplineLog(id);
            log = result.data;
        } catch (e) {
            error = '이용제한 기록을 불러오는데 실패했습니다.';
            log = null;
        } finally {
            loading = false;
        }
    }

    function getPenaltyBadgeVariant(
        period: number
    ): 'default' | 'secondary' | 'destructive' | 'outline' {
        if (period === 0) return 'secondary';
        return 'destructive';
    }

    function formatPeriodRange(log: DisciplineLogDetail): string {
        const penalty = getPenaltyDisplay(log.penalty_period);
        if (log.penalty_period === -1) {
            return `${log.penalty_date_from} ~ 영구`;
        } else if (log.penalty_period === 0) {
            return log.penalty_date_from;
        } else {
            return `${log.penalty_date_from} ~ ${log.penalty_date_to || ''}`;
        }
    }

    function getReportedItemUrl(item: { table: string; id: number; parent?: number }): string {
        if (item.parent && item.parent > 0) {
            return `/${item.table}/${item.id}#comment-${item.parent}`;
        }
        return `/${item.table}/${item.id}`;
    }

    function getReportedItemLabel(item: { table: string; id: number; parent?: number }): string {
        if (item.parent && item.parent > 0) {
            return `/${item.table}/${item.id} (댓글 #${item.parent})`;
        }
        return `/${item.table}/${item.id}`;
    }

    // 소명 가능 여부: 주의(0) 제외, 영구(-1) 및 정지(>=1) 모두 가능
    function isAppealablePenalty(log: DisciplineLogDetail): boolean {
        return log.penalty_period !== 0;
    }

    // 소명 기간 내 여부: 통보 후 15일 이내
    function isWithinAppealPeriod(log: DisciplineLogDetail): boolean {
        const penaltyDate = new Date(log.penalty_date_from);
        const now = new Date();
        const diffDays = Math.floor(
            (now.getTime() - penaltyDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 15;
    }

    // 본인 확인
    function isOwnPenalty(log: DisciplineLogDetail): boolean {
        return !!authStore.user && log.member_id === authStore.user.mb_id;
    }

    onMount(() => {
        fetchLog();
    });
</script>

<svelte:head>
    <title>이용제한 기록 상세</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-6">
    <!-- Back button -->
    <div class="mb-4">
        <Button variant="ghost" href="/disciplinelog" class="gap-2">
            <ArrowLeft class="h-4 w-4" />
            목록으로
        </Button>
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
    {:else if error || !log}
        <Card.Root>
            <Card.Content
                class="text-muted-foreground flex flex-col items-center justify-center py-12"
            >
                <AlertTriangle class="mb-4 h-12 w-12" />
                <p>{error || '이용제한 기록을 찾을 수 없습니다.'}</p>
                <Button variant="outline" class="mt-4" onclick={() => fetchLog()}>다시 시도</Button>
            </Card.Content>
        </Card.Root>
    {:else}
        {@const penalty = getPenaltyDisplay(log.penalty_period)}

        <!-- Basic Info -->
        <Card.Root class="mb-4">
            <Card.Header>
                <Card.Title class="flex items-center gap-2">
                    <User class="h-5 w-5" />
                    기본 정보
                </Card.Title>
            </Card.Header>
            <Card.Content class="space-y-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <div class="text-muted-foreground mb-1 text-sm">닉네임</div>
                        <div class="font-medium">{log.member_nickname}</div>
                    </div>
                    <div>
                        <div class="text-muted-foreground mb-1 text-sm">아이디</div>
                        <div class="font-medium">{log.member_id}</div>
                    </div>
                </div>
                <div>
                    <div class="text-muted-foreground mb-1 text-sm">제재 기간</div>
                    <div class="flex items-center gap-2">
                        <Badge variant={getPenaltyBadgeVariant(log.penalty_period)}>
                            {penalty.text}
                        </Badge>
                        <span class="text-muted-foreground text-sm">
                            ({formatPeriodRange(log)})
                        </span>
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Violation Types -->
        <Card.Root class="mb-4">
            <Card.Header>
                <Card.Title class="flex items-center gap-2">
                    <AlertTriangle class="text-destructive h-5 w-5" />
                    제재 사유
                </Card.Title>
            </Card.Header>
            <Card.Content>
                <div class="space-y-3">
                    {#each log.violation_types as vt}
                        <div class="bg-muted/50 rounded-lg p-3">
                            <div class="text-sm font-medium">{vt.title}</div>
                            <div class="text-muted-foreground mt-1 text-sm">{vt.description}</div>
                        </div>
                    {/each}
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Reported Items -->
        {#if log.reported_items && log.reported_items.length > 0}
            <Card.Root class="mb-4">
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <FileText class="h-5 w-5" />
                        신고된 글
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="space-y-2">
                        {#each log.reported_items as item}
                            <a
                                href={getReportedItemUrl(item)}
                                class="hover:bg-muted/50 flex items-center gap-2 rounded p-2 text-sm transition-all duration-200 ease-out"
                            >
                                <ExternalLink class="text-muted-foreground h-4 w-4" />
                                <span class="text-primary hover:underline">
                                    {getReportedItemLabel(item)}
                                </span>
                            </a>
                        {/each}
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Appeal Info: 주의(0) 제외, 영구(-1) 및 정지(>=1) 모두 표시 -->
        {#if isAppealablePenalty(log)}
            <Card.Root class="border-primary/50 bg-primary/5">
                <Card.Header>
                    <Card.Title class="text-primary flex items-center gap-2">
                        <Calendar class="h-5 w-5" />
                        소명 안내
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <p class="text-muted-foreground mb-4 text-sm">
                        이용제한에 대해 이의가 있으시면 소명 게시판에서 소명하실 수 있습니다. 소명은
                        제재 시작일로부터 15일 이내에만 가능합니다.
                    </p>
                    {#if isOwnPenalty(log)}
                        {#if isWithinAppealPeriod(log)}
                            <Button variant="outline" href="/claim?disciplinelog_id={log.id}">
                                소명하기
                            </Button>
                        {:else}
                            <p class="text-destructive text-sm">
                                소명 가능 기간(15일)이 지났습니다.
                            </p>
                        {/if}
                    {/if}
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Meta Info -->
        <div class="text-muted-foreground mt-4 text-center text-xs">
            작성일: {log.created_at}
        </div>
    {/if}
</div>
