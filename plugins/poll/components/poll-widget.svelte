<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import ChartBar from '@lucide/svelte/icons/chart-bar';
    import Plus from '@lucide/svelte/icons/plus';
    import XIcon from '@lucide/svelte/icons/x';
    import Check from '@lucide/svelte/icons/check';

    let { boardId, postId }: { boardId: string; postId: number } = $props();

    interface PollOption {
        idx: number;
        label: string;
        votes?: number;
    }
    interface PollData {
        exists: boolean;
        can_create?: boolean;
        id?: number;
        question?: string;
        options?: PollOption[];
        allow_multi?: boolean;
        reveal?: string;
        status?: string;
        total_voters?: number;
        my_choices?: number[];
        is_author?: boolean;
        hide_counts?: boolean;
        closes_at?: string;
    }

    let poll = $state<PollData | null>(null);
    let isSubmitting = $state(false);
    let errorMsg = $state('');

    // 작성 폼 상태
    let showCreateForm = $state(false);
    let question = $state('');
    let options = $state<string[]>(['', '']);
    let durationHours = $state(72); // 3일 기본
    let allowMulti = $state(false);
    let revealAfterClose = $state(false);

    // 복수선택 진행 중 체크 상태
    let multiPicks = $state<Set<number>>(new Set());

    const isLoggedIn = $derived(authStore.isAuthenticated);
    const isOpen = $derived(poll?.status === 'open');
    const hasVoted = $derived((poll?.my_choices?.length ?? 0) > 0);
    const showBars = $derived(
        poll?.exists === true && !poll?.hide_counts && (hasVoted || !isOpen || !isLoggedIn)
    );
    const totalVotes = $derived((poll?.options ?? []).reduce((sum, o) => sum + (o.votes ?? 0), 0));

    function percent(votes: number | undefined): number {
        if (!votes || totalVotes === 0) return 0;
        return Math.round((votes / totalVotes) * 100);
    }

    // 결과 도넛 차트용 세그먼트 (bug/13485: 밋밋한 막대에 색상+도넛 시각화 추가).
    // 색상 = dataviz 검증 카테고리 6색을 순환(최대 6선택지). 실제 색값은 하단 <style> 의
    // --poll-c0..5 (라이트/다크 각각 검증본). pathLength=100 정규화라 비율을 그대로 dasharray 에
    // 쓰고, 기하는 반올림 안 한 raw 비율(누적 start)로 계산해 라운딩 틈을 없앤다.
    const donutSegments = $derived.by(() => {
        const opts = poll?.options ?? [];
        let acc = 0;
        return opts.map((o, i) => {
            const raw = totalVotes > 0 ? ((o.votes ?? 0) / totalVotes) * 100 : 0;
            const seg = { start: acc, len: raw, color: `var(--poll-c${i % 6})` };
            acc += raw;
            return seg;
        });
    });

    function remainText(closesAt: string | undefined): string {
        if (!closesAt) return '';
        const diff = new Date(closesAt).getTime() - Date.now();
        if (Number.isNaN(diff) || diff <= 0) return '마감됨';
        const hours = Math.floor(diff / 3600000);
        if (hours >= 24) return `${Math.floor(hours / 24)}일 남음`;
        if (hours >= 1) return `${hours}시간 남음`;
        return `${Math.max(1, Math.floor(diff / 60000))}분 남음`;
    }

    // 요청 시점의 board/post 를 인자로 받아 조회한다. SPA 네비게이션에서 늦게 온 응답이
    // 새 글에 잘못 적용되지 않도록, 응답 도착 시 현재 postId 와 캡처값을 대조해 stale 응답은 폐기.
    async function load(reqBoardId: string, reqPostId: number) {
        try {
            const res = await fetch(`/api/plugins/poll/by-post/${reqBoardId}/${reqPostId}`);
            // SPA 경합 가드: 응답 도착 시점에 다른 글로 이동했으면 폐기 (bug/13673 2차 방지)
            if (reqPostId !== postId) return;
            if (!res.ok) return;
            const body = await res.json();
            if (reqPostId !== postId) return;
            if (body?.success) {
                poll = body.data as PollData;
                multiPicks = new Set(poll?.my_choices ?? []);
            }
        } catch {
            // 위젯은 실패해도 글 읽기를 방해하지 않는다
        }
    }

    // onMount 대신 $effect: SPA 네비게이션(글→글) 시 postId 변경에 반응해 재조회한다 (bug/13673).
    // boardId/postId 를 읽어 의존성으로 추적하고, 값이 바뀌면 이전 글의 stale 상태를 즉시 리셋 후
    // 재조회. 리셋 대상(poll·multiPicks 등)은 effect 안에서 읽지 않으므로 자기참조 재트리거 없음.
    $effect(() => {
        const reqBoardId = boardId;
        const reqPostId = postId;
        // 이전 글의 투표 상태가 새 글에 그대로 남지 않도록 즉시 초기화
        poll = null;
        multiPicks = new Set();
        errorMsg = '';
        showCreateForm = false;
        load(reqBoardId, reqPostId);
    });

    async function api(path: string, method: string, body?: unknown): Promise<boolean> {
        isSubmitting = true;
        errorMsg = '';
        try {
            const res = await fetch(`/api/plugins/poll${path}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
                poll = data.data as PollData;
                multiPicks = new Set(poll?.my_choices ?? []);
                return true;
            }
            errorMsg = data?.error?.message ?? '잠시 후 다시 시도해 주세요.';
            return false;
        } catch {
            errorMsg = '잠시 후 다시 시도해 주세요.';
            return false;
        } finally {
            isSubmitting = false;
        }
    }

    async function voteSingle(idx: number) {
        if (!isLoggedIn || !isOpen || isSubmitting || !poll?.id) return;
        // 같은 항목 재클릭 = 취소
        if (poll.my_choices?.length === 1 && poll.my_choices[0] === idx) {
            await api(`/${poll.id}/vote`, 'DELETE');
            return;
        }
        await api(`/${poll.id}/vote`, 'POST', { option_idxs: [idx] });
    }

    function toggleMultiPick(idx: number) {
        const next = new Set(multiPicks);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        multiPicks = next;
    }

    async function voteMulti() {
        if (!poll?.id || multiPicks.size === 0) return;
        await api(`/${poll.id}/vote`, 'POST', { option_idxs: [...multiPicks].sort() });
    }

    async function closePoll() {
        if (!poll?.id) return;
        await api(`/${poll.id}/close`, 'POST');
    }

    function addOption() {
        if (options.length < 6) options = [...options, ''];
    }

    function removeOption(i: number) {
        if (options.length > 2) options = options.filter((_, j) => j !== i);
    }

    async function createPoll() {
        const labels = options.map((o) => o.trim()).filter(Boolean);
        if (labels.length < 2) {
            errorMsg = '선택지를 2개 이상 입력해 주세요.';
            return;
        }
        const ok = await api('', 'POST', {
            bo_table: boardId,
            wr_id: postId,
            question: question.trim(),
            options: labels,
            allow_multi: allowMulti,
            reveal: revealAfterClose ? 'after_close' : 'after_vote',
            duration_hours: durationHours
        });
        if (ok) showCreateForm = false;
    }
</script>

{#if poll?.exists}
    <Card class="my-4">
        <CardHeader class="pb-2">
            <CardTitle class="flex items-center gap-2 text-base">
                <ChartBar class="text-primary h-4 w-4" />
                {poll.question || '투표'}
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
            {#if showBars}
                {#if totalVotes > 0}
                    <!-- 결과 도넛 차트 (구성비 시각화, bug/13485) -->
                    <div class="mb-2 flex justify-center">
                        <svg
                            viewBox="0 0 120 120"
                            class="h-24 w-24"
                            role="img"
                            aria-label="투표 결과 도넛 차트"
                        >
                            <circle
                                cx="60"
                                cy="60"
                                r="47"
                                fill="none"
                                class="poll-track"
                                stroke-width="15"
                            />
                            {#each donutSegments as seg}
                                {#if seg.len > 0}
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="47"
                                        fill="none"
                                        stroke={seg.color}
                                        stroke-width="15"
                                        pathLength="100"
                                        stroke-dasharray="{seg.len} {100 - seg.len}"
                                        stroke-dashoffset={-seg.start}
                                        transform="rotate(-90 60 60)"
                                    />
                                {/if}
                            {/each}
                            <text
                                x="60"
                                y="57"
                                text-anchor="middle"
                                class="fill-foreground text-[16px] font-bold"
                            >
                                {totalVotes}
                            </text>
                            <text
                                x="60"
                                y="73"
                                text-anchor="middle"
                                class="fill-muted-foreground text-[9px]"
                            >
                                표
                            </text>
                        </svg>
                    </div>
                {/if}
                {#each poll.options ?? [] as opt, i (opt.idx)}
                    {@const mine = poll.my_choices?.includes(opt.idx)}
                    <button
                        type="button"
                        class="bg-muted/50 relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm {isOpen &&
                        isLoggedIn
                            ? 'hover:bg-muted cursor-pointer'
                            : 'cursor-default'}"
                        disabled={!isOpen || !isLoggedIn || isSubmitting}
                        onclick={() =>
                            poll?.allow_multi ? toggleMultiPick(opt.idx) : voteSingle(opt.idx)}
                    >
                        <span
                            class="poll-bar absolute inset-y-0 left-0"
                            style="width: {percent(opt.votes)}%; --seg: var(--poll-c{i % 6})"
                        ></span>
                        <span class="relative flex items-center justify-between gap-2">
                            <span class="flex min-w-0 items-center gap-1.5">
                                <span
                                    class="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style="background: var(--poll-c{i % 6})"
                                ></span>
                                <span class="truncate {mine ? 'font-semibold' : ''}"
                                    >{opt.label}</span
                                >
                                {#if mine}<Check class="text-primary h-3.5 w-3.5 shrink-0" />{/if}
                            </span>
                            <span class="text-muted-foreground shrink-0 text-xs font-medium">
                                {percent(opt.votes)}% ({opt.votes ?? 0})
                            </span>
                        </span>
                    </button>
                {/each}
            {:else}
                {#each poll.options ?? [] as opt (opt.idx)}
                    {@const picked = poll.allow_multi
                        ? multiPicks.has(opt.idx)
                        : poll.my_choices?.includes(opt.idx)}
                    <button
                        type="button"
                        class="block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors {picked
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-primary/40 text-primary hover:bg-primary/5'} {!isLoggedIn ||
                        !isOpen
                            ? 'cursor-default opacity-70'
                            : ''}"
                        disabled={!isLoggedIn || !isOpen || isSubmitting}
                        onclick={() =>
                            poll?.allow_multi ? toggleMultiPick(opt.idx) : voteSingle(opt.idx)}
                    >
                        <span class="flex items-center gap-1.5">
                            {#if picked}<Check class="h-3.5 w-3.5 shrink-0" />{/if}
                            <span class="truncate">{opt.label}</span>
                        </span>
                    </button>
                {/each}
                {#if poll.allow_multi && isLoggedIn && isOpen}
                    <Button
                        size="sm"
                        onclick={voteMulti}
                        disabled={isSubmitting || multiPicks.size === 0}
                    >
                        투표하기
                    </Button>
                {/if}
            {/if}

            <p class="text-muted-foreground flex flex-wrap items-center gap-x-2 pt-1 text-xs">
                <span>{poll.total_voters ?? 0}명 참여</span>
                {#if poll.status === 'closed'}
                    <span>· 마감됨</span>
                {:else if poll.closes_at}
                    <span>· {remainText(poll.closes_at)}</span>
                {/if}
                {#if poll.hide_counts}
                    <span>· 결과는 마감 후 공개</span>
                {:else if hasVoted && isOpen}
                    <span>· 다시 눌러 변경</span>
                {/if}
                {#if !isLoggedIn && isOpen}
                    <span>· 로그인 후 투표할 수 있어요</span>
                {/if}
                {#if poll.is_author && isOpen}
                    <button
                        type="button"
                        class="text-muted-foreground underline"
                        onclick={closePoll}
                        disabled={isSubmitting}>마감하기</button
                    >
                {/if}
            </p>
            {#if errorMsg}
                <p class="text-destructive text-xs">{errorMsg}</p>
            {/if}
        </CardContent>
    </Card>
{:else if poll?.can_create}
    <div class="my-4">
        {#if !showCreateForm}
            <Button variant="outline" size="sm" onclick={() => (showCreateForm = true)}>
                <ChartBar class="mr-1.5 h-4 w-4" />
                이 글에 투표 만들기
            </Button>
        {:else}
            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">투표 만들기</CardTitle>
                </CardHeader>
                <CardContent class="space-y-2">
                    <Input
                        placeholder="질문 (비우면 글 제목이 질문이 됩니다)"
                        bind:value={question}
                        maxlength={200}
                    />
                    {#each options as _, i (i)}
                        <div class="flex items-center gap-2">
                            <Input
                                placeholder="선택지 {i + 1}"
                                bind:value={options[i]}
                                maxlength={100}
                            />
                            {#if options.length > 2}
                                <button
                                    type="button"
                                    class="text-muted-foreground shrink-0"
                                    onclick={() => removeOption(i)}
                                    aria-label="선택지 삭제"
                                >
                                    <XIcon class="h-4 w-4" />
                                </button>
                            {/if}
                        </div>
                    {/each}
                    {#if options.length < 6}
                        <Button variant="ghost" size="sm" onclick={addOption}>
                            <Plus class="mr-1 h-3.5 w-3.5" />선택지 추가
                        </Button>
                    {/if}
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <label class="flex items-center gap-1.5">
                            기간
                            <select
                                class="bg-background rounded-md border px-2 py-1 text-sm"
                                bind:value={durationHours}
                            >
                                <option value={24}>1일</option>
                                <option value={72}>3일</option>
                                <option value={168}>7일</option>
                                <option value={0}>무기한</option>
                            </select>
                        </label>
                        <label class="flex items-center gap-1.5">
                            <input type="checkbox" bind:checked={allowMulti} />
                            복수선택
                        </label>
                        <label class="flex items-center gap-1.5">
                            <input type="checkbox" bind:checked={revealAfterClose} />
                            결과는 마감 후 공개
                        </label>
                    </div>
                    {#if errorMsg}
                        <p class="text-destructive text-xs">{errorMsg}</p>
                    {/if}
                    <div class="flex gap-2 pt-1">
                        <Button size="sm" onclick={createPoll} disabled={isSubmitting}
                            >만들기</Button
                        >
                        <Button variant="ghost" size="sm" onclick={() => (showCreateForm = false)}
                            >취소</Button
                        >
                    </div>
                </CardContent>
            </Card>
        {/if}
    </div>
{/if}

<style>
    /* 투표 결과 도넛/막대 카테고리 팔레트 (bug/13485).
       dataviz 검증본 6색 — 라이트/다크 각각 대비·CVD(ΔE≥8) 통과. 최대 6선택지.
       색은 아이덴티티(도넛 세그먼트·색점·막대)에만 쓰고, 숫자·라벨은 토큰 잉크(fill-foreground 등). */
    :global(:root) {
        --poll-c0: #2a78d6;
        --poll-c1: #eb6834;
        --poll-c2: #1baf7a;
        --poll-c3: #eda100;
        --poll-c4: #e87ba4;
        --poll-c5: #008300;
    }
    :global(.dark),
    :global(.amoled) {
        --poll-c0: #3987e5;
        --poll-c1: #d95926;
        --poll-c2: #199e70;
        --poll-c3: #c98500;
        --poll-c4: #d55181;
        --poll-c5: #008300;
    }
    /* 도넛 트랙: 현재 잉크색을 아주 옅게 (라이트/다크 자동) */
    .poll-track {
        stroke: color-mix(in srgb, currentColor 12%, transparent);
    }
    /* 막대 채움: 선택지 색을 옅게 — 위에 얹힌 라벨 가독성 유지(라이트 대비 relief) */
    .poll-bar {
        background: color-mix(in srgb, var(--seg) 24%, transparent);
    }
</style>
