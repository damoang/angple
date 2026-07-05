<script lang="ts">
    /**
     * 이용제한 기록 상세 페이지
     */
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import Calendar from '@lucide/svelte/icons/calendar';
    import User from '@lucide/svelte/icons/user';
    import FileText from '@lucide/svelte/icons/file-text';
    import Info from '@lucide/svelte/icons/info';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import History from '@lucide/svelte/icons/history';
    import {
        getPenaltyDisplay,
        type DisciplineLogDetail,
        type DisciplineLogListItem
    } from '$lib/api/discipline-log.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { getReportReasonLabel } from '$lib/utils/report-reasons.js';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // SSR 로드(+page.server.ts)에서 상세·회원이력을 미리 받아 즉시 렌더(스피너·클라 왕복 제거).
    // 라우트 파라미터 변경 시 load 가 재실행되므로 목록/이력에서 다른 row 클릭에도 반영된다.
    const log = $derived<DisciplineLogDetail | null>(data.log);
    const memberHistory = $derived<DisciplineLogListItem[]>(data.memberHistory ?? []);
    const error = $derived(data.loadError ? '이용제한 기록을 불러오는데 실패했습니다.' : null);

    function getPenaltyBadgeVariant(
        period: number,
        released: boolean = false
    ): 'default' | 'secondary' | 'destructive' | 'outline' {
        if (released) return 'secondary';
        if (period === 0) return 'outline';
        return 'default';
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

    // 신고 항목이 댓글인지 판별. 글에도 parent>0 으로 들어오는 비정상 데이터 방어:
    // parent == id 또는 parent == 0 또는 falsy → 글로 처리.
    // 정상: parent = 게시글 wr_id, id = 댓글 wr_id (서로 다름)
    function isComment(item: { id: number; parent?: number }): boolean {
        return typeof item.parent === 'number' && item.parent > 0 && item.parent !== item.id;
    }

    function getReportedItemUrl(item: { table: string; id: number; parent?: number }): string {
        if (isComment(item)) {
            // parent = 게시글 ID (wr_parent), id = 댓글 ID (wr_id)
            return `/${item.table}/${item.parent}#c_${item.id}`;
        }
        return `/${item.table}/${item.id}`;
    }

    function getReportedItemLabel(item: { table: string; id: number; parent?: number }): string {
        if (isComment(item)) {
            return `/${item.table}/${item.parent} (댓글 #${item.id})`;
        }
        return `/${item.table}/${item.id}`;
    }

    // 소명 가능 여부: 1일 이상 이용제한만 가능
    function isAppealablePenalty(log: DisciplineLogDetail): boolean {
        return log.penalty_period >= 1;
    }

    // 소명 기간 내 여부: 제재 시작 후 1일 경과 ~ 15일 이내
    function isWithinAppealPeriod(log: DisciplineLogDetail): boolean {
        const penaltyDate = new Date(log.penalty_date_from);
        const now = new Date();
        const diffDays = Math.floor(
            (now.getTime() - penaltyDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= 1 && diffDays <= 15;
    }

    // 본인 확인
    function isOwnPenalty(log: DisciplineLogDetail): boolean {
        return !!authStore.user && log.member_id === authStore.user.mb_id;
    }
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

    {#if error || !log}
        <Card.Root>
            <Card.Content
                class="text-muted-foreground flex flex-col items-center justify-center py-12"
            >
                <AlertTriangle class="mb-4 h-12 w-12" />
                <p>{error || '이용제한 기록을 찾을 수 없습니다.'}</p>
                <Button variant="outline" class="mt-4" href="/disciplinelog">목록으로</Button>
            </Card.Content>
        </Card.Root>
    {:else}
        {@const penalty = getPenaltyDisplay(log.penalty_period, log.penalty_date_to)}

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
                        <Badge
                            variant={getPenaltyBadgeVariant(log.penalty_period, penalty.released)}
                        >
                            {penalty.text}
                        </Badge>
                        {#if penalty.released}
                            <Badge variant="secondary" class="text-xs">해제</Badge>
                        {/if}
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
                    <AlertTriangle class="text-muted-foreground h-5 w-5" />
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

        <!-- 기타 사유: 회원 공개용 (운영자가 입력한 경우에만 표시) -->
        {#if log.member_reason && log.member_reason.trim()}
            <Card.Root class="mb-4">
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <Info class="text-muted-foreground h-5 w-5" />
                        기타 사유
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <p class="whitespace-pre-line text-sm">{log.member_reason}</p>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Memo: 비공개 (관리자 내부용) -->

        <!-- Reported Items -->
        {#if log.reported_items && log.reported_items.length > 0}
            <Card.Root class="mb-4">
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <FileText class="h-5 w-5" />
                        신고 접수된 글
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="space-y-2">
                        {#each log.reported_items as item}
                            <div
                                class="hover:bg-muted/50 rounded p-2 transition-all duration-200 ease-out"
                            >
                                <!-- 삭제 여부와 무관하게 링크 유지 (삭제글도 글 페이지로 이동 가능).
                                     삭제된 경우 취소선 + 삭제됨 배지로 상태만 표시. -->
                                <a
                                    href={getReportedItemUrl(item)}
                                    class="flex items-center gap-2 text-sm"
                                >
                                    <ExternalLink class="text-muted-foreground h-4 w-4" />
                                    <span
                                        class="hover:underline {item.deleted
                                            ? 'text-muted-foreground line-through'
                                            : 'text-primary'}"
                                    >
                                        {getReportedItemLabel(item)}
                                    </span>
                                    {#if item.deleted}
                                        <Badge variant="secondary" class="text-xs">삭제됨</Badge>
                                    {/if}
                                </a>
                                {#if (item.sg_types && item.sg_types.length > 0) || item.penalty_days != null}
                                    <div class="ml-6 mt-1.5 flex flex-wrap items-center gap-1">
                                        {#if item.sg_types}
                                            {#each item.sg_types as code (code)}
                                                <Badge variant="secondary" class="text-xs">
                                                    {getReportReasonLabel(code)}
                                                </Badge>
                                            {/each}
                                        {/if}
                                        {#if item.penalty_days != null}
                                            <Badge variant="outline" class="text-xs">
                                                {getPenaltyDisplay(item.penalty_days).text}
                                            </Badge>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
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
                        제재 시작 후 1일이 지난 시점부터 15일 이내에만 가능합니다.
                    </p>
                    {#if log.claim_post_id}
                        <Button variant="outline" href="/claim/{log.claim_post_id}">
                            소명글 보기
                        </Button>
                    {:else if isOwnPenalty(log)}
                        {#if isWithinAppealPeriod(log)}
                            <Button variant="outline" href="/claim/write?disciplinelog_id={log.id}">
                                소명하기
                            </Button>
                        {:else}
                            <p class="text-muted-foreground text-sm">
                                소명 가능 기간이 아니거나 15일이 지났습니다.
                            </p>
                        {/if}
                    {/if}
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Member History -->
        {#if memberHistory.length > 0}
            <Card.Root class="mt-4">
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <History class="h-5 w-5" />
                        이 회원의 전체 이용제한 내역
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="space-y-2">
                        {#each memberHistory as item}
                            {@const itemPenalty = getPenaltyDisplay(
                                item.penalty_period,
                                item.penalty_date_to
                            )}
                            <a
                                href="/disciplinelog/{item.id}"
                                class="hover:bg-muted/50 flex items-center justify-between rounded p-2 text-sm transition-all duration-200 ease-out {item.id ===
                                log.id
                                    ? 'bg-primary/10 border-primary/30 border font-semibold'
                                    : ''}"
                            >
                                <div class="flex items-center gap-3">
                                    <span class="text-muted-foreground"
                                        >{item.penalty_date_from}</span
                                    >
                                    <Badge
                                        variant={getPenaltyBadgeVariant(
                                            item.penalty_period,
                                            itemPenalty.released
                                        )}
                                    >
                                        {itemPenalty.text}
                                    </Badge>
                                    {#if itemPenalty.released}
                                        <Badge variant="secondary" class="text-xs">해제</Badge>
                                    {/if}
                                </div>
                                <span class="text-muted-foreground max-w-[200px] truncate">
                                    {item.violation_titles.join(', ')}
                                </span>
                            </a>
                        {/each}
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Meta Info -->
        <div class="text-muted-foreground mt-4 text-center text-xs">
            작성일: {log.created_at}
        </div>
    {/if}
</div>
