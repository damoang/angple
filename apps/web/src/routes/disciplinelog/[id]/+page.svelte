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
    import FileText from '@lucide/svelte/icons/file-text';
    import Info from '@lucide/svelte/icons/info';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import History from '@lucide/svelte/icons/history';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import {
        getPenaltyDisplay,
        type DisciplineLogDetail,
        type DisciplineLogListItem
    } from '$lib/api/discipline-log.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { getReportReasonLabel } from '$lib/utils/report-reasons.js';
    import { penaltySeverity, SEVERITY_BADGE } from '$lib/utils/penalty-severity.js';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // SSR 로드(+page.server.ts)에서 상세·회원이력을 미리 받아 즉시 렌더(스피너·클라 왕복 제거).
    // 라우트 파라미터 변경 시 load 가 재실행되므로 목록/이력에서 다른 row 클릭에도 반영된다.
    const log = $derived<DisciplineLogDetail | null>(data.log);
    const memberHistory = $derived<DisciplineLogListItem[]>(data.memberHistory ?? []);
    const error = $derived(data.loadError ? '이용제한 기록을 불러오는데 실패했습니다.' : null);

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

    // 소명 가능 여부: 주의(0)만 제외 — 정지(>=1)와 영구(-1) 모두 소명 대상.
    // (기존 `>= 1` 은 영구제재 -1 을 배제해, 영구 이용제한 회원이 소명 진입점 자체를
    //  볼 수 없던 문제(#12973)를 바로잡는다.)
    function isAppealablePenalty(log: DisciplineLogDetail): boolean {
        return log.penalty_period === -1 || log.penalty_period >= 1;
    }

    // 소명 기간 내 여부: 제재 당일(0일)부터 15일 이내.
    // (기존 `>= 1` 은 제재 당일 소명을 막아, 징계 직후 바로 소명하려는 회원이
    //  소명 버튼을 볼 수 없던 문제(#12973)를 바로잡는다. 미래 일자 제재는 음수라 제외.)
    //
    // ⛔ `new Date("2026-08-11 23:05:15")` 로 파싱하지 말 것.
    //    공백으로 구분한 "YYYY-MM-DD HH:MM:SS" 는 **JS 표준 형식이 아니다.**
    //    Chrome 은 관대하게 받아주지만 **Safari·iOS 는 Invalid Date** 를 낸다.
    //    그러면 getTime() 이 NaN → `NaN >= 0` 이 false → 어제 받은 처분에도
    //    "소명 가능 기간이 지났습니다" 가 떠서 **소명 자체가 막힌다**
    //    (2026-08-12 회원 제보, log 4245 · 제재 다음 날).
    //    ∴ 문자열을 직접 분해해 **로컬 자정 기준 날짜 차이**로 센다.
    //    시:분:초는 버린다 — 15일 판정에 시각은 의미가 없고, UTC 파싱으로 하루가
    //    밀리는 사고([[feedback-db-utc-now-kst-trap]])도 이 방식이면 생기지 않는다.
    function isWithinAppealPeriod(log: DisciplineLogDetail): boolean {
        const [y, m, d] = (log.penalty_date_from ?? '')
            .slice(0, 10)
            .split('-')
            .map((v) => parseInt(v, 10));
        if (!y || !m || !d) return false;
        const penaltyMidnight = new Date(y, m - 1, d).getTime();
        const today = new Date();
        const todayMidnight = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        ).getTime();
        const diffDays = Math.round((todayMidnight - penaltyMidnight) / 86400000);
        return diffDays >= 0 && diffDays <= 15;
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
        {@const severity = penaltySeverity(log.penalty_period, penalty.released, !!log.revoked_at)}

        <!-- 소명 인용 해제 배너: revoked_at 있을 때만. 회수 사실만 공개(회수자·사유 비공개). -->
        {#if log.revoked_at}
            <Card.Root
                class="mb-3 border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
            >
                <Card.Content class="flex items-start gap-3 py-4">
                    <ShieldCheck
                        class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <div class="text-sm">
                        <div class="font-semibold text-emerald-800 dark:text-emerald-300">
                            이 이용제한은 소명 인용으로 해제되었습니다
                        </div>
                        <div class="mt-0.5 text-emerald-700/80 dark:text-emerald-400/80">
                            해제일 {log.revoked_at.slice(0, 10)}
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}

        <!--
          요약 헤더 — 누가·얼마나·언제를 한 블록에 모은다.
          기존에는 "기본 정보"와 "제재 기간"이 카드 안에서 라벨·값 쌍으로 흩어져
          정작 중요한 정보를 찾는 데 시선이 여러 번 움직였다.
        -->
        <Card.Root class="mb-3">
            <Card.Content>
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span class="text-lg font-bold">{log.member_nickname}</span>
                    <span class="text-muted-foreground/70 text-xs">{log.member_id}</span>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" class={SEVERITY_BADGE[severity]}>
                        {penalty.text}
                    </Badge>
                    {#if log.revoked_at}
                        <Badge
                            variant="secondary"
                            class="border-emerald-300 bg-emerald-100 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                            소명 해제
                        </Badge>
                    {:else if penalty.released}
                        <Badge variant="secondary" class="text-xs">해제</Badge>
                    {/if}
                    <span class="text-muted-foreground text-sm">
                        {#if log.revoked_at}
                            <!-- 회수된 제재: 원래 종료일에 취소선 + 조기 해제 표기.
                                 (기간이 만료된 게 아니라 소명 인용으로 중간에 풀렸음을 명확히) -->
                            ({log.penalty_date_from} 시작 ·
                            {#if log.penalty_period !== 0}
                                <s class="opacity-60"
                                    >{log.penalty_period === -1
                                        ? '영구'
                                        : log.penalty_date_to || ''}</s
                                > ·
                            {/if}
                            <span class="text-emerald-700 dark:text-emerald-400"
                                >{log.revoked_at} 소명 인용으로 해제</span
                            >)
                        {:else}
                            ({formatPeriodRange(log)})
                        {/if}
                    </span>
                </div>

                <!--
                  사유는 요약 헤더 안에 둔다 — 제재의 "무엇 때문에"가 기간과 떨어지면 안 읽힌다.

                  ⛔ 단, **글마다 사유가 다르면 여기에 나열하지 않는다.**
                     상단 사유는 항목별 사유의 합집합이라, 다섯 글이 A·B 이고 한 글만 C·D 여도
                     A·B·C·D 가 전부 뜬다. 회원은 네 가지 사유로 제한받았다고 읽는다.
                     사람은 큰 글씨를 먼저 읽어서, 아래 글별 목록을 봐도 오해가 풀리지 않는다.
                     그런 건은 안내 한 줄로 대체하고 사유는 글별 목록에서만 읽게 한다.
                -->
                {#if log.reasons_differ_by_item}
                    <div class="mt-3 flex items-baseline gap-2 border-t pt-3">
                        <AlertTriangle class="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span class="text-muted-foreground text-sm">
                            적용 사유는 글마다 다릅니다 — 아래 목록에서 확인하세요
                        </span>
                    </div>
                {:else if log.violation_types.length > 0}
                    <div class="mt-3 space-y-2 border-t pt-3">
                        {#each log.violation_types as vt}
                            <div>
                                <div class="flex items-baseline gap-2">
                                    <AlertTriangle
                                        class="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0"
                                    />
                                    <span class="text-sm font-medium">{vt.title}</span>
                                </div>
                                <div class="text-muted-foreground mt-0.5 pl-[1.375rem] text-sm">
                                    {vt.description}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!--
                  사유 정정 — 소명이 인용돼 사유가 빠지면 위 목록에서 조용히 사라진다.
                  그러면 회원은 소명이 반영됐는지 알 수 없다. 무엇이 빠졌는지 남긴다.
                  ⛔ 정정한 운영자·내부 메모는 응답에 없다(회수 배너와 같은 기준).
                -->
                {#if log.reason_corrections?.length}
                    <div class="mt-3 border-t pt-3">
                        <div
                            class="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium"
                        >
                            <Info class="h-3.5 w-3.5" />
                            사유 정정
                        </div>
                        <ul class="space-y-1.5">
                            {#each log.reason_corrections as c, i (i)}
                                <li class="text-sm">
                                    {#if c.removed?.length}
                                        <span class="text-emerald-700 dark:text-emerald-400"
                                            >제외 — {c.removed.join(', ')}</span
                                        >
                                    {/if}
                                    {#if c.added?.length}
                                        <span class="text-muted-foreground"
                                            >{c.removed?.length ? ' · ' : ''}추가 — {c.added.join(
                                                ', '
                                            )}</span
                                        >
                                    {/if}
                                    <span class="text-muted-foreground/70 ml-1 text-xs">
                                        {c.at.slice(0, 10)}
                                        {#if c.claim_id}
                                            · <a
                                                href="/claim/{c.claim_id}"
                                                class="underline underline-offset-2">소명 보기</a
                                            >
                                        {/if}
                                    </span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>

        <!--
          소명 액션 — 본인 기록일 때만 요약 바로 아래에 둔다.
          회원이 이 페이지에 오는 이유의 절반이 "어떻게 푸나"인데, 카드 여러 장 아래에
          묻혀 있으면 스크롤하지 않은 사람은 소명 경로를 못 본다.
        -->
        {#if isAppealablePenalty(log) && isOwnPenalty(log) && !log.claim_post_id}
            <Card.Root class="border-primary/50 bg-primary/5 mb-3">
                <Card.Content class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-start gap-2">
                        <Calendar class="text-primary mt-0.5 h-4 w-4 shrink-0" />
                        <div class="text-sm">
                            <div class="font-medium">이 이용제한에 소명할 수 있습니다</div>
                            <div class="text-muted-foreground text-xs">
                                제재일부터 15일 이내에 소명 게시판에서 접수합니다.
                            </div>
                        </div>
                    </div>
                    {#if isWithinAppealPeriod(log)}
                        <Button href="/claim/write?disciplinelog_id={log.id}">소명하기</Button>
                    {:else}
                        <span class="text-muted-foreground text-xs"
                            >소명 가능 기간이 지났습니다</span
                        >
                    {/if}
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- 기타 사유: 회원 공개용 (운영자가 입력한 경우에만 표시) -->
        {#if log.member_reason && log.member_reason.trim()}
            <Card.Root class="mb-3">
                <Card.Content>
                    <div
                        class="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium"
                    >
                        <Info class="h-3.5 w-3.5" />
                        기타 사유
                    </div>
                    <p class="whitespace-pre-line text-sm">{log.member_reason}</p>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- 안내: 회원 공개용 외부 안내문 (운영자가 입력한 경우에만 표시) -->
        {#if log.public_description && log.public_description.trim()}
            <Card.Root class="mb-3">
                <Card.Content>
                    <div
                        class="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium"
                    >
                        <Megaphone class="h-3.5 w-3.5" />
                        안내
                    </div>
                    <p class="whitespace-pre-line text-sm">{log.public_description}</p>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Memo: 비공개 (관리자 내부용) -->

        <!-- Reported Items -->
        {#if log.reported_items && log.reported_items.length > 0}
            <Card.Root class="mb-3">
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <FileText class="text-muted-foreground h-5 w-5" />
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

        <!--
          소명 안내(참고용) — 본인 미소명 건은 위 CTA 가 맡으므로 여기서는 제외한다.
          남는 경우는 ① 이미 소명글이 있는 건 ② 남의 기록(공개 게시판이라 이쪽이 다수).
        -->
        {#if isAppealablePenalty(log) && (log.claim_post_id || !isOwnPenalty(log))}
            <Card.Root class="border-primary/50 bg-primary/5 mb-3">
                <Card.Content>
                    <div class="text-primary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                        <Calendar class="h-3.5 w-3.5" />
                        소명 안내
                    </div>
                    <p class="text-muted-foreground text-sm">
                        이용제한에 대해 이의가 있으시면 소명 게시판에서 소명하실 수 있습니다. 소명은
                        제재일부터 15일 이내에 가능합니다.
                    </p>
                    {#if log.claim_post_id}
                        <Button variant="outline" class="mt-3" href="/claim/{log.claim_post_id}">
                            소명글 보기
                        </Button>
                    {/if}
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Member History -->
        {#if memberHistory.length > 0}
            <Card.Root class="mb-3">
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <History class="text-muted-foreground h-5 w-5" />
                        이 회원의 전체 이용제한 내역
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="space-y-0.5">
                        {#each memberHistory as item}
                            {@const itemPenalty = getPenaltyDisplay(
                                item.penalty_period,
                                item.penalty_date_to
                            )}
                            {@const itemSeverity = penaltySeverity(
                                item.penalty_period,
                                itemPenalty.released,
                                item.revoked
                            )}
                            <a
                                href="/disciplinelog/{item.id}"
                                class="hover:bg-muted/50 flex items-center justify-between rounded px-2 py-1.5 text-sm leading-tight transition-all duration-200 ease-out {item.id ===
                                log.id
                                    ? 'bg-primary/10 ring-primary/30 font-semibold ring-1'
                                    : ''}"
                            >
                                <div class="flex items-center gap-3">
                                    <span class="text-muted-foreground"
                                        >{item.penalty_date_from}</span
                                    >
                                    <Badge variant="outline" class={SEVERITY_BADGE[itemSeverity]}>
                                        {itemPenalty.text}
                                    </Badge>
                                    {#if item.revoked}
                                        <Badge variant="secondary" class="text-xs">소명 해제</Badge>
                                    {:else if itemPenalty.released}
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
            기록 등록 {log.created_at}
        </div>
    {/if}
</div>
