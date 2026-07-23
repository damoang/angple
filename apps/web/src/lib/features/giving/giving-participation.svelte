<script lang="ts">
    import { untrack } from 'svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { givingApi, type GivingDetail } from './api.js';
    import { METHOD_INFO, methodLabel, isNumberMethod, type GivingMethod } from './methods.js';
    import { parseBidNumbers } from './pure/lowest-unique.js';
    import MethodSelect from './method-select.svelte';
    import DrawResult from './draw-result.svelte';

    let { post, boardId }: { post: { id: number | string }; boardId?: string } = $props();

    let detail = $state<GivingDetail | null>(null);
    let loadError = $state<string | null>(null);
    let busy = $state(false);
    let actionMsg = $state<string | null>(null);
    let actionErr = $state<string | null>(null);

    // lowest_unique 응모 입력
    let numbersInput = $state('');
    // 주최자 지명 입력
    let designateWinner = $state('');
    let designateReason = $state('');
    // 주최자 설정
    let showSetup = $state(false);
    let cfgMethod = $state<GivingMethod>('lowest_unique');
    let cfgCapacity = $state(1);
    let cfgNumberMax = $state(100);
    let cfgUnit = $state(100);

    async function load() {
        loadError = null;
        try {
            const d = await givingApi.detail(post.id);
            detail = d;
            cfgMethod = d.method;
            cfgCapacity = d.capacity ?? 1;
            cfgNumberMax = d.number_max ?? 100;
            cfgUnit = d.unit_price || 100;
        } catch (e) {
            loadError = e instanceof Error ? e.message : '나눔 정보를 불러오지 못했습니다.';
        }
    }

    $effect(() => {
        // post.id 변경 시 재로딩
        void post.id;
        untrack(() => load());
    });

    const method: GivingMethod = $derived(detail?.method ?? 'lowest_unique');
    const isEnded = $derived(detail?.status === 'ended');
    const isActive = $derived(detail?.status === 'active');
    const drawn = $derived(!!detail?.draw);

    // 참가를 받을 수 없는 두 가지 미완성 상태.
    //   ① configured=false : 설정(방식·인원) 자체가 저장되지 않음 → 백엔드가 참가를 거부
    //   ② no_giving        : 시작·마감 일시가 비어 상태 판정이 안 됨 → 참가 UI가 안 그려짐
    // 둘 다 주최자는 정상 게시했다고 믿기 쉬운 상태라 명시적으로 알린다.
    const missingConfig = $derived(detail ? detail.configured === false : false);
    const missingSchedule = $derived(detail?.status === 'no_giving');
    const needsSetup = $derived(!drawn && (missingConfig || missingSchedule));
    const setupReason = $derived(
        missingConfig && missingSchedule
            ? '나눔 방식과 일정이 저장되지 않았어요.'
            : missingConfig
              ? '나눔 방식이 저장되지 않았어요.'
              : '시작·마감 일시가 비어 있어요.'
    );

    const parsedPreview = $derived(numbersInput ? parseBidNumbers(numbersInput) : []);
    const estCost = $derived(parsedPreview.length * (detail?.unit_price ?? 0));

    function flash(msg: string, isErr = false) {
        if (isErr) {
            actionErr = msg;
            actionMsg = null;
        } else {
            actionMsg = msg;
            actionErr = null;
        }
    }

    async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
        if (busy) return;
        busy = true;
        actionErr = null;
        actionMsg = null;
        try {
            const r = await fn();
            await load();
            return r;
        } catch (e) {
            flash(e instanceof Error ? e.message : '처리에 실패했습니다.', true);
        } finally {
            busy = false;
        }
    }

    async function submitBid() {
        if (parsedPreview.length === 0) {
            flash('올바른 응모 번호를 입력해주세요.', true);
            return;
        }
        await guard(async () => {
            await givingApi.bid(post.id, numbersInput);
            numbersInput = '';
            flash('응모가 완료되었습니다.');
        });
    }

    async function joinFree() {
        await guard(async () => {
            await givingApi.bid(post.id);
            flash('참가가 완료되었습니다.');
        });
    }

    async function saveConfig() {
        await guard(async () => {
            await givingApi.config(post.id, {
                method: cfgMethod,
                capacity: cfgCapacity,
                number_max: cfgNumberMax
            });
            showSetup = false;
            flash('나눔 방식을 저장했습니다.');
        });
    }

    async function runDraw() {
        const designated = METHOD_INFO[method].hostDesignated;
        if (designated && !designateWinner) {
            flash('당첨자를 지정해주세요.', true);
            return;
        }
        if (method === 'curation' && !designateReason) {
            flash('선정 사유를 입력해주세요.', true);
            return;
        }
        await guard(async () => {
            await givingApi.draw(
                post.id,
                designated ? { winner_mb_id: designateWinner, reason: designateReason } : undefined
            );
            flash('개표가 완료되었습니다.');
        });
    }

    async function admin(action: 'pause' | 'resume' | 'force-stop') {
        await guard(async () => {
            await givingApi.admin(post.id, action);
            flash(
                action === 'pause'
                    ? '일시정지했습니다.'
                    : action === 'resume'
                      ? '재개했습니다.'
                      : '강제종료했습니다.'
            );
        });
    }

    const statusLabel = $derived(
        {
            active: '진행 중',
            waiting: '대기 중',
            paused: '일시정지',
            ended: '종료',
            no_giving: '일정 미정'
        }[detail?.status ?? 'no_giving']
    );
</script>

{#if detail}
    <section class="border-border my-6 rounded-xl border p-4 sm:p-5">
        <header class="mb-3 flex flex-wrap items-center gap-2">
            <span class="text-base font-bold">🎁 나눔</span>
            <span
                class="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold"
                >{methodLabel(method)}</span
            >
            <span
                class="rounded-full px-2.5 py-0.5 text-xs font-medium {isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-muted text-muted-foreground'}">{statusLabel}</span
            >
            {#if detail.is_urgent}
                <span class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                    >마감 임박</span
                >
            {/if}
        </header>

        <!-- 설정이 없거나 일정이 비면 아무도 참가할 수 없다. 조용히 두지 않고 알린다.
             (2026-07-23 첫 나눔이 일정 누락으로 참가 버튼 없이 게시됐다) -->
        {#if needsSetup}
            <div
                class="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            >
                {#if detail.is_host}
                    <p class="font-semibold">아직 참가를 받을 수 없어요</p>
                    <p class="mt-1">
                        {setupReason} 아래 설정을 완료하면 회원들이 참가할 수 있어요.
                    </p>
                {:else}
                    <p>주최자가 나눔을 준비하고 있어요. 잠시 후 다시 확인해주세요.</p>
                {/if}
            </div>
        {/if}

        <div class="text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>참가자 <strong class="text-foreground">{detail.participant_count}</strong>명</span
            >
            {#if isNumberMethod(method)}
                <span
                    >응모 번호 <strong class="text-foreground">{detail.total_numbers}</strong
                    >개</span
                >
                <span>단가 <strong class="text-foreground">{detail.unit_price}</strong>pt</span>
            {:else if detail.capacity}
                <span>당첨 <strong class="text-foreground">{detail.capacity}</strong>명</span>
            {/if}
            {#if detail.giving_end}
                <span>마감 {detail.giving_end}</span>
            {/if}
        </div>

        {#if actionMsg}
            <p
                class="mb-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30"
            >
                {actionMsg}
            </p>
        {/if}
        {#if actionErr}
            <p class="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30">
                {actionErr}
            </p>
        {/if}

        <!-- 당첨 결과 -->
        {#if drawn && detail.draw}
            <DrawResult draw={detail.draw} />
        {/if}

        <!-- 참가 UI (비주최자, 진행 중, 미개표) -->
        {#if !detail.is_host && isActive && !drawn}
            {#if !authStore.isAuthenticated}
                <p class="text-muted-foreground text-sm">참가하려면 로그인이 필요합니다.</p>
            {:else if method === 'lowest_unique'}
                <div class="space-y-2">
                    <label for="giving-bid-input" class="text-foreground block text-sm font-medium"
                        >응모 번호 (예: 1,3,5-10,15~20)</label
                    >
                    <input
                        id="giving-bid-input"
                        type="text"
                        bind:value={numbersInput}
                        placeholder="번호 또는 범위 입력"
                        class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                    />
                    {#if parsedPreview.length > 0}
                        <p class="text-muted-foreground text-xs">
                            {parsedPreview.length}개 번호 · 예상 {estCost}pt 소모
                        </p>
                    {/if}
                    <button
                        type="button"
                        onclick={submitBid}
                        disabled={busy || parsedPreview.length === 0}
                        class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >응모하기</button
                    >
                </div>
            {:else if method === 'curation' || method === 'host_pick'}
                <div class="space-y-2">
                    <p class="text-muted-foreground text-sm">
                        {method === 'curation'
                            ? '아래 댓글로 사연을 남겨 참여하세요. 주최자가 읽고 선정합니다.'
                            : '참가 버튼을 누르거나 댓글을 남겨 참여하세요. 주최자가 지정합니다.'}
                    </p>
                    <button
                        type="button"
                        onclick={joinFree}
                        disabled={busy || detail.my_participation.joined}
                        class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >{detail.my_participation.joined ? '참가 완료' : '참가하기'}</button
                    >
                </div>
            {:else}
                <!-- random / ladder -->
                <button
                    type="button"
                    onclick={joinFree}
                    disabled={busy || detail.my_participation.joined}
                    class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >{detail.my_participation.joined ? '참가 완료' : '무료 응모하기'}</button
                >
            {/if}

            {#if detail.my_participation.joined && method === 'lowest_unique'}
                <p class="text-muted-foreground mt-2 text-xs">
                    내 응모: {detail.my_participation.numbers} ({detail.my_participation.count}개, {detail
                        .my_participation.points}pt)
                </p>
            {/if}
        {/if}

        <!-- 주최자 컨트롤 -->
        {#if detail.is_host && !drawn}
            <div class="border-border mt-3 space-y-3 border-t pt-3">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold">주최자 관리</span>
                    <button
                        type="button"
                        class="text-primary text-xs underline"
                        onclick={() => (showSetup = !showSetup)}>나눔 방식 설정</button
                    >
                </div>

                {#if showSetup}
                    <div class="border-border rounded-md border p-3">
                        <MethodSelect
                            bind:method={cfgMethod}
                            bind:capacity={cfgCapacity}
                            bind:numberMax={cfgNumberMax}
                            bind:unitPrice={cfgUnit}
                        />
                        <p class="text-muted-foreground mt-2 text-xs">
                            ※ 단가는 글 본문(번호 단가)에서 관리됩니다. 방식·정원·최대번호가
                            저장됩니다.
                        </p>
                        <button
                            type="button"
                            onclick={saveConfig}
                            disabled={busy}
                            class="bg-primary text-primary-foreground mt-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                            >설정 저장</button
                        >
                    </div>
                {/if}

                <!-- 개표 -->
                {#if METHOD_INFO[method].hostDesignated}
                    <div class="space-y-2">
                        <label for="giving-winner" class="text-foreground block text-sm font-medium"
                            >당첨자 지정</label
                        >
                        <input
                            id="giving-winner"
                            list="giving-participant-list"
                            bind:value={designateWinner}
                            placeholder="참가자 또는 댓글 작성자 mb_id"
                            class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <datalist id="giving-participant-list">
                            {#each detail.participants as p (p)}
                                <option value={p}></option>
                            {/each}
                        </datalist>
                        {#if method === 'curation'}
                            <textarea
                                bind:value={designateReason}
                                placeholder="선정 사유 (공개됩니다)"
                                rows="2"
                                class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                            ></textarea>
                        {/if}
                    </div>
                {/if}

                <div class="flex flex-wrap gap-2">
                    {#if detail.status === 'paused'}
                        <button
                            type="button"
                            onclick={() => admin('resume')}
                            disabled={busy}
                            class="border-border rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                            >재개</button
                        >
                    {:else if isActive}
                        <button
                            type="button"
                            onclick={() => admin('pause')}
                            disabled={busy}
                            class="border-border rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                            >일시정지</button
                        >
                    {/if}
                    <button
                        type="button"
                        onclick={runDraw}
                        disabled={busy}
                        class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                        >{METHOD_INFO[method].hostDesignated ? '당첨자 확정' : '개표하기'}</button
                    >
                    {#if !METHOD_INFO[method].hostDesignated}
                        <button
                            type="button"
                            onclick={() => admin('force-stop')}
                            disabled={busy}
                            class="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
                            >강제종료(즉시 개표)</button
                        >
                    {/if}
                </div>
            </div>
        {/if}

        <!-- 종료·미개표 안내 -->
        {#if isEnded && !drawn && !detail.is_host}
            <p class="text-muted-foreground text-sm">
                종료된 나눔입니다. 개표를 기다리고 있습니다.
            </p>
        {/if}
    </section>
{:else if loadError}
    <p class="text-muted-foreground my-4 text-sm">{loadError}</p>
{/if}
