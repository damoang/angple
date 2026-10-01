<script lang="ts">
    /**
     * 관리자 앙팡(럭키 포인트) 설정·현황.
     *
     * - 전역 설정(lucky_config): 전체 스위치·상한·무작위 단계·고정 시간대 → PUT /admin/lucky/config
     *   (본문 = config 객체만. 응답 전체를 보내면 400)
     * - 게시판 앙복(게시판별 lucky): 고른 게시판들에 일괄 적용 → PUT /admin/lucky/boards
     * - 오늘 현황(stats)·최근 변경 이력
     *
     * 판단(본문 구성·미리보기·형식 검사·안내)은 $lib/utils/angpang-admin 의 순수 함수다.
     * ⛔ 무작위 단계의 그날 시각은 어떤 응답에도 없다 — 이 화면도 보여 주지 않는다.
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import Sparkles from '@lucide/svelte/icons/sparkles';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Plus from '@lucide/svelte/icons/plus';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import History from '@lucide/svelte/icons/history';
    import FieldError from '$lib/components/admin/angpang/field-error.svelte';
    import PrizeTable from '$lib/components/admin/angpang/prize-table.svelte';
    import {
        getLuckyAdminConfig,
        getLuckyAdminStats,
        putLuckyAdminBoards,
        putLuckyAdminConfig,
        LuckyAdminError,
        type LuckyAdminConfigView,
        type LuckyAdminStats,
        type LuckyBoardSetting
    } from '$lib/api/admin-lucky';
    import {
        ALL_DAY_END,
        ALL_DAY_START,
        buildBoardLuckyBody,
        buildPutConfigBody,
        clientBoardErrors,
        clientFieldErrors,
        cloneConfig,
        diffValues,
        emptyBoardLucky,
        emptyFixedWindow,
        emptyWindow,
        fieldErrorMap,
        fixedWindowNotes,
        formatDiffValue,
        kstToday,
        removedTierNames,
        submissionKey,
        summarizeBoardLucky,
        type LuckyAdminConfig,
        type LuckyBoardLucky,
        type LuckyFieldError
    } from '$lib/utils/angpang-admin';
    import { formatLuckyAtShort } from '$lib/utils/lucky-badge';

    /** 미리보기·이력에서 최상위 키를 사람이 읽는 이름으로. */
    const LABELS: Record<string, string> = {
        enabled: '전체 켜기',
        include_comments: '댓글 포함',
        member_daily_cap: '회원당 하루 상한',
        daily_cap: '(예전 키) 글 상한',
        daily_cap_post: '글 하루 상한',
        daily_cap_comment: '댓글 하루 상한',
        min_comment_chars: '댓글 최소 글자 수',
        expire_days: '포인트 만료일수',
        window_start_hour: '무작위 단계 시작 시',
        window_end_hour: '무작위 단계 끝 시',
        windows: '무작위 단계',
        fixed_windows: '고정 시간대'
    };

    function labelOf(path: string): string {
        const top = path.match(/^[a-z_]+/)?.[0] ?? '';
        const label = LABELS[top];
        return label ? `${label} · ${path}` : path || '(전체)';
    }

    // ─── 전역 설정 ─────────────────────────────────────────────
    let view = $state<LuckyAdminConfigView | null>(null);
    let original = $state.raw<LuckyAdminConfig | null>(null);
    let form = $state<LuckyAdminConfig | null>(null);
    let loading = $state(true);
    let loadError = $state('');

    let errors = $state<LuckyFieldError[]>([]);
    const errMap = $derived(fieldErrorMap(errors));
    let previewOpen = $state(false);
    let parseAck = $state(false);
    let showRaw = $state(false);
    let saving = $state(false);
    let saveMessage = $state('');
    let saveError = $state('');
    /** 미리보기를 연 시점의 전송 본문. 이후 폼이 바뀌면 미리보기를 닫는다(미리보기≠실제 전송). */
    let previewKey = $state('');

    const body = $derived(form ? buildPutConfigBody(form) : null);

    $effect(() => {
        if (previewOpen && submissionKey(body) !== previewKey) previewOpen = false;
    });
    const diff = $derived(original && body ? diffValues(original, body) : []);
    const removedNames = $derived(original && body ? removedTierNames(original, body) : []);
    const cacheTtl = $derived(view?.cache_ttl_seconds ?? 0);
    const parseError = $derived(view?.stored_parse_error === true);
    const canSave = $derived(
        !saving && (diff.length > 0 || parseError) && (!parseError || parseAck)
    );
    const rawText = $derived.by(() => {
        const raw = view?.stored_raw;
        if (raw === undefined || raw === null) return '';
        if (typeof raw === 'string') return raw;
        try {
            return JSON.stringify(raw, null, 2);
        } catch {
            return String(raw);
        }
    });

    async function loadConfig() {
        loading = true;
        loadError = '';
        try {
            const v = await getLuckyAdminConfig();
            view = v;
            original = cloneConfig(v.config);
            form = cloneConfig(v.config);
            errors = [];
            previewOpen = false;
            parseAck = false;
            showRaw = false;
        } catch (e) {
            loadError = e instanceof Error ? e.message : '설정을 불러오지 못했습니다';
        } finally {
            loading = false;
        }
    }

    function openPreview() {
        if (!form) return;
        saveMessage = '';
        saveError = '';
        const local = clientFieldErrors(form);
        errors = local;
        if (local.length > 0) {
            previewOpen = false;
            saveError = '입력칸을 확인해 주세요.';
            return;
        }
        previewKey = submissionKey(body);
        previewOpen = true;
    }

    function resetForm() {
        if (!original) return;
        form = cloneConfig(original);
        errors = [];
        previewOpen = false;
        saveMessage = '';
        saveError = '';
    }

    async function save() {
        if (!form || !canSave) return;
        // 미리보기 뒤에 칸을 비웠을 수 있다 — 보내기 직전에 다시 검사한다.
        // 빈칸(null)은 백엔드에서 기본값·0 이 되어 확률 0 이면 그 단계가 꺼진다.
        const local = clientFieldErrors(form);
        if (local.length > 0 || submissionKey(buildPutConfigBody(form)) !== previewKey) {
            errors = local;
            previewOpen = false;
            saveError =
                local.length > 0
                    ? '입력칸을 확인해 주세요.'
                    : '미리보기 뒤에 값이 바뀌었습니다. 다시 미리보기를 확인해 주세요.';
            return;
        }
        saving = true;
        saveMessage = '';
        saveError = '';
        try {
            await putLuckyAdminConfig(form);
            await loadConfig();
            saveMessage = `저장했습니다. 다른 서버는 최대 ${cacheTtl}초 뒤 반영됩니다.`;
        } catch (e) {
            if (e instanceof LuckyAdminError && e.status === 400) {
                errors = e.fields;
                previewOpen = false;
                saveError = '입력 값이 올바르지 않습니다. 표시된 칸을 고쳐 주세요.';
            } else {
                saveError = e instanceof Error ? e.message : '저장하지 못했습니다';
            }
        } finally {
            saving = false;
        }
    }

    function addWindow() {
        if (!form) return;
        form.windows = [...form.windows, emptyWindow()];
    }
    function removeWindow(index: number) {
        if (!form) return;
        form.windows = form.windows.filter((_, i) => i !== index);
    }
    function addFixed() {
        if (!form) return;
        form.fixed_windows = [...form.fixed_windows, emptyFixedWindow()];
    }
    function removeFixed(index: number) {
        if (!form) return;
        form.fixed_windows = form.fixed_windows.filter((_, i) => i !== index);
    }
    function setAllDay(index: number) {
        if (!form) return;
        form.fixed_windows[index].start = ALL_DAY_START;
        form.fixed_windows[index].end = ALL_DAY_END;
    }

    // ─── 게시판 앙복 ───────────────────────────────────────────
    let boardFilter = $state('');
    let selectedBoards = $state<string[]>([]);
    let boardForm = $state<LuckyBoardLucky>(emptyBoardLucky());
    let boardErrors = $state<LuckyFieldError[]>([]);
    const boardErrMap = $derived(fieldErrorMap(boardErrors));
    let boardPreviewOpen = $state(false);
    let boardSaving = $state(false);
    let boardMessage = $state('');
    let boardError = $state('');
    let boardPreviewKey = $state('');

    const boards = $derived<LuckyBoardSetting[]>(view?.boards ?? []);
    const filteredBoards = $derived.by(() => {
        const q = boardFilter.trim().toLowerCase();
        if (!q) return boards;
        return boards.filter(
            (b) => b.board_id.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q)
        );
    });
    const boardBody = $derived(buildBoardLuckyBody(boardForm));

    $effect(() => {
        if (
            boardPreviewOpen &&
            submissionKey({ ids: selectedBoards, lucky: boardBody }) !== boardPreviewKey
        ) {
            boardPreviewOpen = false;
        }
    });
    const boardPreview = $derived(
        selectedBoards.map((id) => {
            const b = boards.find((x) => x.board_id === id);
            const before = b?.lucky ? buildBoardLuckyBody(b.lucky) : null;
            return {
                id,
                subject: b?.subject ?? '',
                before,
                changes: before ? diffValues(before, boardBody) : []
            };
        })
    );
    /** board_ids[i] 오류는 입력칸이 없으므로 목록 위에 모아 보여 준다. */
    const boardListErrors = $derived(
        boardErrors.filter((e) => e.field === 'board_ids' || e.field.startsWith('board_ids['))
    );

    function isSelected(id: string): boolean {
        return selectedBoards.includes(id);
    }
    function toggleBoard(id: string, on: boolean) {
        selectedBoards = on
            ? isSelected(id)
                ? selectedBoards
                : [...selectedBoards, id]
            : selectedBoards.filter((x) => x !== id);
        boardPreviewOpen = false;
    }
    function selectFiltered() {
        const add = filteredBoards.map((b) => b.board_id).filter((id) => !isSelected(id));
        selectedBoards = [...selectedBoards, ...add];
        boardPreviewOpen = false;
    }
    function clearSelection() {
        selectedBoards = [];
        boardPreviewOpen = false;
    }
    /** 고른 게시판이 하나면 그 게시판의 현재 값을 폼으로 불러온다. */
    function loadFromSelected() {
        if (selectedBoards.length !== 1) return;
        const b = boards.find((x) => x.board_id === selectedBoards[0]);
        boardForm = b?.lucky ? buildBoardLuckyBody(b.lucky) : emptyBoardLucky();
        boardErrors = [];
    }

    /** 게시판 목록만 다시 읽는다 — 전역 설정 폼의 저장 안 한 편집은 건드리지 않는다. */
    async function refreshBoards() {
        try {
            const v = await getLuckyAdminConfig();
            if (view) view.boards = v.boards;
        } catch (e) {
            boardError = e instanceof Error ? e.message : '게시판 목록을 다시 읽지 못했습니다';
        }
    }

    function openBoardPreview() {
        boardMessage = '';
        boardError = '';
        const local = clientBoardErrors(selectedBoards, boardForm);
        boardErrors = local;
        if (local.length > 0) {
            boardPreviewOpen = false;
            boardError = '입력칸을 확인해 주세요.';
            return;
        }
        boardPreviewKey = submissionKey({ ids: selectedBoards, lucky: boardBody });
        boardPreviewOpen = true;
    }

    async function saveBoards() {
        if (boardSaving || selectedBoards.length === 0) return;
        // 미리보기 뒤에 칸을 비웠을 수 있다 — 보내기 직전에 다시 검사한다.
        const local = clientBoardErrors(selectedBoards, boardForm);
        const key = submissionKey({ ids: selectedBoards, lucky: buildBoardLuckyBody(boardForm) });
        if (local.length > 0 || key !== boardPreviewKey) {
            boardErrors = local;
            boardPreviewOpen = false;
            boardError =
                local.length > 0
                    ? '입력칸을 확인해 주세요.'
                    : '미리보기 뒤에 값이 바뀌었습니다. 다시 미리보기를 확인해 주세요.';
            return;
        }
        boardSaving = true;
        boardMessage = '';
        boardError = '';
        try {
            const res = await putLuckyAdminBoards([...selectedBoards], boardBody);
            boardPreviewOpen = false;
            await refreshBoards();
            boardMessage = `${res.board_ids.length}개 게시판에 적용했습니다.`;
        } catch (e) {
            if (e instanceof LuckyAdminError && e.status === 400) {
                boardErrors = e.fields;
                boardPreviewOpen = false;
                boardError = '입력 값이 올바르지 않습니다. 표시된 칸을 고쳐 주세요.';
            } else {
                boardError = e instanceof Error ? e.message : '적용하지 못했습니다';
            }
        } finally {
            boardSaving = false;
        }
    }

    // ─── 현황(stats) ───────────────────────────────────────────
    let statsDate = $state(kstToday());
    let stats = $state<LuckyAdminStats | null>(null);
    let statsLoading = $state(false);
    let statsError = $state('');
    let autoRefresh = $state(false);

    async function loadStats() {
        statsLoading = true;
        statsError = '';
        try {
            stats = await getLuckyAdminStats(statsDate);
        } catch (e) {
            statsError = e instanceof Error ? e.message : '현황을 불러오지 못했습니다';
        } finally {
            statsLoading = false;
        }
    }

    $effect(() => {
        if (!autoRefresh) return;
        const timer = setInterval(() => {
            if (!statsLoading) void loadStats();
        }, 30_000);
        return () => clearInterval(timer);
    });

    function remainingText(remaining: number | null, cap: number): string {
        if (cap <= 0 || remaining === null) return '무제한';
        return `${remaining.toLocaleString('ko-KR')} / ${cap.toLocaleString('ko-KR')}`;
    }

    // ─── 이력 ──────────────────────────────────────────────────
    function historyDiff(before: unknown, after: unknown) {
        if (!before || typeof before !== 'object') return null;
        return diffValues(before, after);
    }

    onMount(() => {
        void loadConfig();
        void loadStats();
    });
</script>

<svelte:head>
    <title>앙팡 | 관리자</title>
</svelte:head>

<div class="space-y-6">
    <div class="flex items-center gap-3">
        <Sparkles class="text-primary h-6 w-6 shrink-0" />
        <div>
            <h1 class="text-2xl font-bold">앙팡</h1>
            <p class="text-muted-foreground text-sm">럭키 포인트 설정과 오늘 현황</p>
        </div>
    </div>

    {#if loading && !form}
        <div class="flex items-center gap-2 py-6">
            <Loader2 class="h-4 w-4 animate-spin" />
            <span class="text-muted-foreground text-sm">불러오는 중...</span>
        </div>
    {:else if loadError && !form}
        <Card.Root>
            <Card.Content class="space-y-3 py-6">
                <p class="text-destructive text-sm">{loadError}</p>
                <Button variant="outline" size="sm" onclick={loadConfig}>다시 시도</Button>
            </Card.Content>
        </Card.Root>
    {/if}

    {#if parseError}
        <div
            class="border-destructive/50 bg-destructive/10 space-y-2 rounded-lg border p-4"
            role="alert"
        >
            <div class="flex items-start gap-2">
                <TriangleAlert class="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                <div class="min-w-0 space-y-1">
                    <p class="font-semibold">저장된 설정을 해석하지 못했습니다</p>
                    <p class="text-muted-foreground text-sm">
                        아래 값은 지급 경로가 보정해서 읽은 값이라 원래 의도와 다를 수 있습니다.
                        이대로 저장하면 저장된 원문이 덮어써집니다.
                    </p>
                    {#if view?.stored_parse_message?.length}
                        <ul class="list-disc pl-5 text-sm">
                            {#each view.stored_parse_message as m, i (i)}
                                <li>
                                    {#if m.field}<code class="text-xs">{m.field}</code>:
                                    {/if}{m.message}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                    <Button variant="outline" size="sm" onclick={() => (showRaw = !showRaw)}>
                        {showRaw ? '원문 닫기' : '원문 보기'}
                    </Button>
                    {#if showRaw}
                        <pre
                            class="bg-background max-h-80 overflow-auto whitespace-pre-wrap break-all rounded border p-2 text-xs">{rawText}</pre>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    {#if form}
        <!-- 전체 스위치·상한 -->
        <Card.Root>
            <Card.Header class="pb-3">
                <Card.Title class="text-base">전체 설정</Card.Title>
                <Card.Description>
                    저장하면 이 서버에는 바로, 다른 서버는 최대 {cacheTtl}초 뒤 반영됩니다.
                </Card.Description>
            </Card.Header>
            <Card.Content class="space-y-5">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <Label class="font-medium">전체 켜기</Label>
                        <p class="text-muted-foreground mt-0.5 text-xs">
                            끄면 어느 게시판에서도 지급하지 않습니다.
                        </p>
                    </div>
                    <Switch
                        checked={form.enabled}
                        onCheckedChange={(v) => form && (form.enabled = v)}
                        aria-label="전체 켜기"
                    />
                </div>
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <Label class="font-medium">댓글 포함</Label>
                        <p class="text-muted-foreground mt-0.5 text-xs">끄면 글에만 발동합니다.</p>
                    </div>
                    <Switch
                        checked={form.include_comments}
                        onCheckedChange={(v) => form && (form.include_comments = v)}
                        aria-label="댓글 포함"
                    />
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <Label for="lk-cap-post">글 하루 상한(사이트 전체)</Label>
                        <Input
                            id="lk-cap-post"
                            type="number"
                            min="0"
                            class="mt-1"
                            bind:value={form.daily_cap_post}
                        />
                        <p class="text-muted-foreground mt-1 text-xs">0 = 무제한</p>
                        <FieldError errors={errMap} path="daily_cap_post" />
                        <FieldError errors={errMap} path="daily_cap" />
                    </div>
                    <div>
                        <Label for="lk-cap-comment">댓글 하루 상한(사이트 전체)</Label>
                        <Input
                            id="lk-cap-comment"
                            type="number"
                            min="0"
                            class="mt-1"
                            bind:value={form.daily_cap_comment}
                        />
                        <p class="text-muted-foreground mt-1 text-xs">0 = 무제한</p>
                        <FieldError errors={errMap} path="daily_cap_comment" />
                    </div>
                    <div>
                        <Label for="lk-cap-member">회원당 하루 상한(글+댓글)</Label>
                        <Input
                            id="lk-cap-member"
                            type="number"
                            min="0"
                            class="mt-1"
                            bind:value={form.member_daily_cap}
                        />
                        <p class="text-muted-foreground mt-1 text-xs">0 = 무제한</p>
                        <FieldError errors={errMap} path="member_daily_cap" />
                    </div>
                    <div>
                        <Label for="lk-min-chars">댓글 최소 글자 수</Label>
                        <Input
                            id="lk-min-chars"
                            type="number"
                            min="0"
                            class="mt-1"
                            bind:value={form.min_comment_chars}
                        />
                        <p class="text-muted-foreground mt-1 text-xs">0 = 제한 없음</p>
                        <FieldError errors={errMap} path="min_comment_chars" />
                    </div>
                    <div>
                        <Label for="lk-expire">포인트 만료일수</Label>
                        <Input
                            id="lk-expire"
                            type="number"
                            min="0"
                            class="mt-1"
                            bind:value={form.expire_days}
                        />
                        <p class="text-muted-foreground mt-1 text-xs">0 = 만료 없음</p>
                        <FieldError errors={errMap} path="expire_days" />
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- 무작위 단계 -->
        <Card.Root>
            <Card.Header class="pb-3">
                <Card.Title class="text-base">무작위 단계</Card.Title>
                <Card.Description>
                    하루 한 번, 아래 시 범위 안에서 서버가 정한 시각에 열립니다. 그 시각은 이
                    화면에도 나오지 않습니다. 확률은 분모(1/N)이고 0 은 끔입니다.
                </Card.Description>
            </Card.Header>
            <Card.Content class="space-y-4">
                <div class="grid grid-cols-2 gap-4 sm:max-w-md">
                    <div>
                        <Label for="lk-ws">시작 시(KST, 포함)</Label>
                        <Input
                            id="lk-ws"
                            type="number"
                            min="0"
                            max="23"
                            class="mt-1"
                            bind:value={form.window_start_hour}
                        />
                        <FieldError errors={errMap} path="window_start_hour" />
                    </div>
                    <div>
                        <Label for="lk-we">끝 시(KST, 제외)</Label>
                        <Input
                            id="lk-we"
                            type="number"
                            min="1"
                            max="24"
                            class="mt-1"
                            bind:value={form.window_end_hour}
                        />
                        <FieldError errors={errMap} path="window_end_hour" />
                    </div>
                </div>
                <FieldError errors={errMap} path="windows" />

                {#each form.windows as w, i (i)}
                    <div class="space-y-3 rounded-lg border p-3">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-sm font-semibold">단계 {i + 1}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onclick={() => removeWindow(i)}
                            >
                                <Trash2 class="mr-1 h-3.5 w-3.5" />삭제
                            </Button>
                        </div>
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div class="sm:col-span-2 lg:col-span-1">
                                <Label for="lk-w{i}-name">이름</Label>
                                <Input id="lk-w{i}-name" class="mt-1" bind:value={w.name} />
                                <FieldError errors={errMap} path="windows[{i}].name" />
                            </div>
                            <div>
                                <Label for="lk-w{i}-min">길이(분)</Label>
                                <Input
                                    id="lk-w{i}-min"
                                    type="number"
                                    min="1"
                                    class="mt-1"
                                    bind:value={w.minutes}
                                />
                                <FieldError errors={errMap} path="windows[{i}].minutes" />
                            </div>
                            <div>
                                <Label for="lk-w{i}-odds">글 확률 1/N</Label>
                                <Input
                                    id="lk-w{i}-odds"
                                    type="number"
                                    min="0"
                                    class="mt-1"
                                    bind:value={w.odds}
                                />
                                <FieldError errors={errMap} path="windows[{i}].odds" />
                            </div>
                            <div>
                                <Label for="lk-w{i}-codds">댓글 확률 1/N</Label>
                                <Input
                                    id="lk-w{i}-codds"
                                    type="number"
                                    min="0"
                                    class="mt-1"
                                    bind:value={w.comment_odds}
                                />
                                <FieldError errors={errMap} path="windows[{i}].comment_odds" />
                            </div>
                            <div>
                                <Label for="lk-w{i}-pts">최대 포인트</Label>
                                <Input
                                    id="lk-w{i}-pts"
                                    type="number"
                                    min="0"
                                    class="mt-1"
                                    bind:value={w.points}
                                />
                                <FieldError errors={errMap} path="windows[{i}].points" />
                            </div>
                        </div>
                        <PrizeTable
                            bind:prizes={w.prizes}
                            errors={errMap}
                            path="windows[{i}].prizes"
                            idPrefix="lk-w{i}"
                        />
                    </div>
                {/each}
                <Button type="button" variant="outline" size="sm" onclick={addWindow}>
                    <Plus class="mr-1 h-3.5 w-3.5" />무작위 단계 추가
                </Button>
            </Card.Content>
        </Card.Root>

        <!-- 고정 시간대 -->
        <Card.Root>
            <Card.Header class="pb-3">
                <Card.Title class="text-base">고정 시간대</Card.Title>
                <Card.Description>매일 같은 KST 시각에 열립니다.</Card.Description>
            </Card.Header>
            <Card.Content class="space-y-4">
                <ul class="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
                    <li>끝 시각은 포함되지 않습니다(시작 포함, 끝 제외).</li>
                    <li>
                        「하루 종일」은 00:00~23:59 이고, 끝 시각이 포함되지 않아 마지막 1분이
                        빠집니다.
                    </li>
                    <li>글 확률이 0(끔)이면 그 시간대는 열리지 않습니다.</li>
                    <li>댓글 확률이 0(끔)이면 그 시간대에서 댓글은 발동하지 않습니다.</li>
                    <li>
                        끝이 시작보다 이르면 자정을 넘는 구간입니다. 겹치면 위쪽 줄이 우선입니다.
                    </li>
                    <li>무작위 단계가 열려 있으면 무작위 단계가 먼저입니다.</li>
                </ul>
                <div
                    class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs"
                >
                    <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                        고정 시간대 이름을 바꾸거나 지우면, 그 이름으로 지급된 과거 당첨 배지의 단계
                        라벨이 사라집니다(지급 금액 표시는 그대로).
                    </span>
                </div>
                <FieldError errors={errMap} path="fixed_windows" />

                {#each form.fixed_windows as f, i (i)}
                    {@const notes = fixedWindowNotes(f)}
                    <div class="space-y-3 rounded-lg border p-3">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-sm font-semibold">시간대 {i + 1}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onclick={() => removeFixed(i)}
                            >
                                <Trash2 class="mr-1 h-3.5 w-3.5" />삭제
                            </Button>
                        </div>
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div class="sm:col-span-2 lg:col-span-1">
                                <Label for="lk-f{i}-name">이름</Label>
                                <Input id="lk-f{i}-name" class="mt-1" bind:value={f.name} />
                                <FieldError errors={errMap} path="fixed_windows[{i}].name" />
                            </div>
                            <div>
                                <Label for="lk-f{i}-start">시작(KST, 포함)</Label>
                                <Input
                                    id="lk-f{i}-start"
                                    type="time"
                                    class="mt-1"
                                    bind:value={f.start}
                                />
                                <FieldError errors={errMap} path="fixed_windows[{i}].start" />
                            </div>
                            <div>
                                <Label for="lk-f{i}-end">끝(KST, 제외)</Label>
                                <Input
                                    id="lk-f{i}-end"
                                    type="time"
                                    class="mt-1"
                                    bind:value={f.end}
                                />
                                <FieldError errors={errMap} path="fixed_windows[{i}].end" />
                            </div>
                            <div>
                                <Label for="lk-f{i}-odds">글 확률 1/N</Label>
                                <Input
                                    id="lk-f{i}-odds"
                                    type="number"
                                    min="0"
                                    class="mt-1"
                                    bind:value={f.odds}
                                />
                                <FieldError errors={errMap} path="fixed_windows[{i}].odds" />
                            </div>
                            <div>
                                <Label for="lk-f{i}-codds">댓글 확률 1/N</Label>
                                <Input
                                    id="lk-f{i}-codds"
                                    type="number"
                                    min="0"
                                    class="mt-1"
                                    bind:value={f.comment_odds}
                                />
                                <FieldError
                                    errors={errMap}
                                    path="fixed_windows[{i}].comment_odds"
                                />
                            </div>
                            <div>
                                <Label for="lk-f{i}-pts">최대 포인트</Label>
                                <Input
                                    id="lk-f{i}-pts"
                                    type="number"
                                    min="0"
                                    class="mt-1"
                                    bind:value={f.points}
                                />
                                <FieldError errors={errMap} path="fixed_windows[{i}].points" />
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onclick={() => setAllDay(i)}
                        >
                            하루 종일(00:00~23:59)
                        </Button>
                        {#if notes.length > 0}
                            <ul class="list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
                                {#each notes as n (n)}
                                    <li>{n}</li>
                                {/each}
                            </ul>
                        {/if}
                        <PrizeTable
                            bind:prizes={f.prizes}
                            errors={errMap}
                            path="fixed_windows[{i}].prizes"
                            idPrefix="lk-f{i}"
                        />
                    </div>
                {/each}
                <Button type="button" variant="outline" size="sm" onclick={addFixed}>
                    <Plus class="mr-1 h-3.5 w-3.5" />고정 시간대 추가
                </Button>
            </Card.Content>
        </Card.Root>

        <!-- 저장(미리보기 → 확인) -->
        <Card.Root>
            <Card.Header class="pb-3">
                <Card.Title class="text-base">저장</Card.Title>
                <Card.Description>
                    바뀌는 값을 먼저 확인한 뒤 저장합니다. 다른 서버는 최대 {cacheTtl}초 뒤
                    반영됩니다.
                </Card.Description>
            </Card.Header>
            <Card.Content class="space-y-3">
                {#if errors.length > 0}
                    <div class="border-destructive/40 rounded-md border p-2 text-sm" role="alert">
                        <p class="text-destructive font-medium">고칠 곳 {errors.length}개</p>
                        <ul class="mt-1 list-disc pl-5 text-xs">
                            {#each errors as e, i (i)}
                                <li><code>{e.field || '(전체)'}</code>: {e.message}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                {#if previewOpen}
                    <div class="space-y-3 rounded-md border p-3">
                        <p class="text-sm font-semibold">변경 미리보기 ({diff.length}개)</p>
                        {#if diff.length === 0}
                            <p class="text-muted-foreground text-sm">바뀐 값이 없습니다.</p>
                        {:else}
                            <ul class="max-h-80 space-y-1 overflow-auto text-xs">
                                {#each diff as d (d.path)}
                                    <li class="break-all">
                                        <span class="text-muted-foreground">{labelOf(d.path)}</span>
                                        <br />
                                        <span class="line-through opacity-70"
                                            >{formatDiffValue(d.before)}</span
                                        >
                                        →
                                        <span class="font-medium">{formatDiffValue(d.after)}</span>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                        {#if removedNames.length > 0}
                            <div
                                class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs"
                            >
                                <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <span>
                                    사라지는 이름: <strong>{removedNames.join(', ')}</strong>. 이
                                    이름으로 지급된 과거 당첨 배지의 단계 라벨이 사라집니다.
                                </span>
                            </div>
                        {/if}
                        {#if parseError}
                            <label class="flex items-start gap-2 text-sm">
                                <Checkbox
                                    checked={parseAck}
                                    onCheckedChange={(v) => (parseAck = v === true)}
                                    class="mt-0.5"
                                />
                                <span>
                                    저장된 설정을 해석하지 못한 상태입니다. 저장하면 원문이 이
                                    값으로 덮어써지는 것을 확인했습니다.
                                </span>
                            </label>
                        {/if}
                        <div class="flex flex-wrap gap-2">
                            <Button onclick={save} disabled={!canSave}>
                                {#if saving}<Loader2 class="mr-1 h-4 w-4 animate-spin" />{/if}
                                이대로 저장
                            </Button>
                            <Button variant="outline" onclick={() => (previewOpen = false)}>
                                취소
                            </Button>
                        </div>
                    </div>
                {:else}
                    <div class="flex flex-wrap gap-2">
                        <Button onclick={openPreview}>변경 미리보기</Button>
                        <Button variant="outline" onclick={resetForm}>되돌리기</Button>
                    </div>
                {/if}
                {#if saveMessage}<p class="text-sm text-green-600">{saveMessage}</p>{/if}
                {#if saveError}<p class="text-destructive text-sm">{saveError}</p>{/if}
            </Card.Content>
        </Card.Root>

        <!-- 게시판 앙복 -->
        <Card.Root>
            <Card.Header class="pb-3">
                <Card.Title class="text-base">게시판 앙복(평소 확률)</Card.Title>
                <Card.Description>
                    고른 게시판들의 앙복 설정을 아래 값으로 통째로 바꿉니다. 게시판의 다른 설정은
                    그대로입니다.
                </Card.Description>
            </Card.Header>
            <Card.Content class="space-y-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Input
                        class="w-full sm:w-64"
                        placeholder="게시판 ID·이름 검색"
                        bind:value={boardFilter}
                    />
                    <Button variant="outline" size="sm" onclick={selectFiltered}>
                        보이는 것 모두 선택
                    </Button>
                    <Button variant="outline" size="sm" onclick={clearSelection}>선택 해제</Button>
                    <span class="text-muted-foreground text-xs">{selectedBoards.length}개 선택</span
                    >
                </div>
                {#each boardListErrors as e, i (i)}
                    <p class="text-destructive text-xs">{e.field}: {e.message}</p>
                {/each}
                <div class="max-h-72 overflow-auto rounded-md border">
                    {#each filteredBoards as b (b.board_id)}
                        <label
                            class="hover:bg-accent flex cursor-pointer items-start gap-2 border-b px-3 py-2 last:border-b-0"
                        >
                            <Checkbox
                                checked={isSelected(b.board_id)}
                                onCheckedChange={(v) => toggleBoard(b.board_id, v === true)}
                                class="mt-0.5"
                            />
                            <span class="min-w-0 flex-1">
                                <span class="text-sm font-medium">{b.subject || b.board_id}</span>
                                <span class="text-muted-foreground ml-1 text-xs">{b.board_id}</span>
                                <span class="text-muted-foreground block text-xs">
                                    {summarizeBoardLucky(b.lucky)}
                                </span>
                            </span>
                        </label>
                    {:else}
                        <p class="text-muted-foreground p-3 text-sm">게시판이 없습니다.</p>
                    {/each}
                </div>

                <div class="space-y-3 rounded-lg border p-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-sm font-semibold">적용할 값</span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedBoards.length !== 1}
                            onclick={loadFromSelected}
                        >
                            고른 게시판 값 불러오기
                        </Button>
                    </div>
                    <div class="flex items-center gap-3">
                        <Switch
                            checked={boardForm.enabled}
                            onCheckedChange={(v) => (boardForm.enabled = v)}
                            aria-label="게시판 앙복 사용"
                        />
                        <span class="text-sm">사용</span>
                    </div>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <Label for="lk-b-odds">글 확률 1/N</Label>
                            <Input
                                id="lk-b-odds"
                                type="number"
                                min="0"
                                class="mt-1"
                                bind:value={boardForm.odds}
                            />
                            <FieldError errors={boardErrMap} path="lucky.odds" />
                        </div>
                        <div>
                            <Label for="lk-b-codds">댓글 확률 1/N</Label>
                            <Input
                                id="lk-b-codds"
                                type="number"
                                min="0"
                                class="mt-1"
                                bind:value={boardForm.comment_odds}
                            />
                            <FieldError errors={boardErrMap} path="lucky.comment_odds" />
                        </div>
                        <div>
                            <Label for="lk-b-pts">최대 포인트</Label>
                            <Input
                                id="lk-b-pts"
                                type="number"
                                min="0"
                                class="mt-1"
                                bind:value={boardForm.points}
                            />
                            <FieldError errors={boardErrMap} path="lucky.points" />
                        </div>
                    </div>
                    <p class="text-muted-foreground text-xs">
                        확률 0 은 끔입니다(글 0 이면 글, 댓글 0 이면 댓글이 그 게시판에서 발동하지
                        않음).
                    </p>
                    <PrizeTable
                        bind:prizes={boardForm.prizes}
                        errors={boardErrMap}
                        path="lucky.prizes"
                        idPrefix="lk-b"
                    />
                    <FieldError errors={boardErrMap} path="lucky" />
                </div>

                {#if boardPreviewOpen}
                    <div class="space-y-2 rounded-md border p-3">
                        <p class="text-sm font-semibold">
                            적용 미리보기 ({boardPreview.length}개 게시판)
                        </p>
                        <ul class="max-h-72 space-y-2 overflow-auto text-xs">
                            {#each boardPreview as p (p.id)}
                                <li class="break-all">
                                    <span class="font-medium">{p.subject || p.id}</span>
                                    <span class="text-muted-foreground">({p.id})</span>
                                    {#if !p.before}
                                        — 설정 없음 → {summarizeBoardLucky(boardBody)}
                                    {:else if p.changes.length === 0}
                                        — 바뀌는 값 없음
                                    {:else}
                                        <ul class="mt-0.5 pl-3">
                                            {#each p.changes as d (d.path)}
                                                <li>
                                                    {d.path}:
                                                    <span class="line-through opacity-70"
                                                        >{formatDiffValue(d.before)}</span
                                                    >
                                                    →
                                                    <span class="font-medium"
                                                        >{formatDiffValue(d.after)}</span
                                                    >
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                        <div class="flex flex-wrap gap-2">
                            <Button onclick={saveBoards} disabled={boardSaving}>
                                {#if boardSaving}<Loader2 class="mr-1 h-4 w-4 animate-spin" />{/if}
                                이대로 적용
                            </Button>
                            <Button variant="outline" onclick={() => (boardPreviewOpen = false)}>
                                취소
                            </Button>
                        </div>
                    </div>
                {:else}
                    <Button onclick={openBoardPreview} disabled={selectedBoards.length === 0}>
                        적용 미리보기
                    </Button>
                {/if}
                {#if boardMessage}<p class="text-sm text-green-600">{boardMessage}</p>{/if}
                {#if boardError}<p class="text-destructive text-sm">{boardError}</p>{/if}
            </Card.Content>
        </Card.Root>
    {/if}

    <!-- 현황 -->
    <Card.Root>
        <Card.Header class="pb-3">
            <Card.Title class="text-base">현황</Card.Title>
            <Card.Description>
                KST 하루 기준. 남은 상한은 지금 저장된 설정 값 기준입니다.
            </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
                <Input
                    type="date"
                    class="w-auto"
                    bind:value={statsDate}
                    onchange={() => loadStats()}
                    aria-label="날짜"
                />
                <Button variant="outline" size="sm" onclick={loadStats} disabled={statsLoading}>
                    <RefreshCw class="mr-1 h-3.5 w-3.5 {statsLoading ? 'animate-spin' : ''}" />
                    새로고침
                </Button>
                <label class="flex items-center gap-2 text-sm">
                    <Switch
                        checked={autoRefresh}
                        onCheckedChange={(v) => (autoRefresh = v)}
                        aria-label="30초마다 새로고침"
                    />
                    30초마다 새로고침
                </label>
            </div>
            {#if statsError}<p class="text-destructive text-sm">{statsError}</p>{/if}
            {#if stats}
                <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div class="rounded-md border p-3">
                        <p class="text-muted-foreground text-xs">글 당첨</p>
                        <p class="text-xl font-bold">{stats.post.wins.toLocaleString('ko-KR')}</p>
                        <p class="text-muted-foreground text-xs">
                            남은 상한 {remainingText(stats.post.remaining, stats.post.cap)}
                        </p>
                    </div>
                    <div class="rounded-md border p-3">
                        <p class="text-muted-foreground text-xs">댓글 당첨</p>
                        <p class="text-xl font-bold">
                            {stats.comment.wins.toLocaleString('ko-KR')}
                        </p>
                        <p class="text-muted-foreground text-xs">
                            남은 상한 {remainingText(stats.comment.remaining, stats.comment.cap)}
                        </p>
                    </div>
                    <div class="rounded-md border p-3">
                        <p class="text-muted-foreground text-xs">포인트·경험치 합계</p>
                        <p class="text-xl font-bold">
                            {stats.points_total.toLocaleString('ko-KR')}p
                        </p>
                        <p class="text-muted-foreground text-xs">
                            {stats.exp_total.toLocaleString('ko-KR')}XP
                        </p>
                    </div>
                    <div class="rounded-md border p-3">
                        <p class="text-muted-foreground text-xs">당첨 회원 수</p>
                        <p class="text-xl font-bold">{stats.members.toLocaleString('ko-KR')}</p>
                    </div>
                </div>

                {#if stats.tiers.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each stats.tiers as t (t.tier)}
                            <Badge variant="secondary">
                                {t.tier || '단계 없음'}
                                {t.count.toLocaleString('ko-KR')}
                            </Badge>
                        {/each}
                    </div>
                {/if}

                <div class="overflow-x-auto">
                    <table class="w-full min-w-[560px] text-sm">
                        <thead>
                            <tr class="text-muted-foreground border-b text-left text-xs">
                                <th class="py-1 pr-2 font-normal">시각</th>
                                <th class="py-1 pr-2 font-normal">닉네임</th>
                                <th class="py-1 pr-2 font-normal">게시판</th>
                                <th class="py-1 pr-2 font-normal">글</th>
                                <th class="py-1 pr-2 text-right font-normal">포인트</th>
                                <th class="py-1 pr-2 text-right font-normal">XP</th>
                                <th class="py-1 font-normal">단계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each stats.recent as r, i (i)}
                                <tr class="border-b last:border-b-0">
                                    <td class="whitespace-nowrap py-1 pr-2">
                                        {formatLuckyAtShort(r.at)}
                                    </td>
                                    <td class="py-1 pr-2">{r.nickname}</td>
                                    <td class="py-1 pr-2">{r.board_id}</td>
                                    <td class="whitespace-nowrap py-1 pr-2">
                                        {#if r.kind === 'post'}
                                            <a
                                                class="text-primary hover:underline"
                                                href="/{r.board_id}/{r.wr_id}"
                                                target="_blank"
                                                rel="noopener">글 {r.wr_id}</a
                                            >
                                        {:else}
                                            <span title="댓글 번호">댓글 {r.wr_id}</span>
                                        {/if}
                                    </td>
                                    <td class="py-1 pr-2 text-right">
                                        {r.amount.toLocaleString('ko-KR')}
                                    </td>
                                    <td class="py-1 pr-2 text-right">
                                        {r.exp.toLocaleString('ko-KR')}
                                    </td>
                                    <td class="py-1">{r.tier || '-'}</td>
                                </tr>
                            {:else}
                                <tr>
                                    <td colspan="7" class="text-muted-foreground py-3 text-center">
                                        당첨이 없습니다.
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {:else if statsLoading}
                <div class="flex items-center gap-2 py-2">
                    <Loader2 class="h-4 w-4 animate-spin" />
                    <span class="text-muted-foreground text-sm">불러오는 중...</span>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    <!-- 최근 변경 이력 -->
    {#if view}
        <Card.Root>
            <Card.Header class="pb-3">
                <Card.Title class="flex items-center gap-2 text-base">
                    <History class="h-4 w-4" />최근 변경 이력
                </Card.Title>
            </Card.Header>
            <Card.Content>
                {#if view.history.length === 0}
                    <p class="text-muted-foreground text-sm">이력이 없습니다.</p>
                {:else}
                    <ul class="space-y-2">
                        {#each view.history as h, i (i)}
                            {@const changes = historyDiff(h.before, h.after)}
                            <li class="rounded-md border p-2">
                                <details>
                                    <summary class="cursor-pointer text-sm">
                                        {formatLuckyAtShort(h.at)} · {h.by}
                                        <span class="text-muted-foreground text-xs">
                                            {changes === null
                                                ? '처음 저장'
                                                : `${changes.length}개 변경`}
                                        </span>
                                    </summary>
                                    {#if changes && changes.length > 0}
                                        <ul class="mt-2 space-y-1 text-xs">
                                            {#each changes as d (d.path)}
                                                <li class="break-all">
                                                    <span class="text-muted-foreground"
                                                        >{labelOf(d.path)}</span
                                                    >:
                                                    <span class="line-through opacity-70"
                                                        >{formatDiffValue(d.before)}</span
                                                    >
                                                    →
                                                    <span class="font-medium"
                                                        >{formatDiffValue(d.after)}</span
                                                    >
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </details>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </Card.Content>
        </Card.Root>
    {/if}
</div>
