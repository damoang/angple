<script lang="ts">
    /**
     * 앙티티 작품 관리 — 대기(자동 후보) / 활성 / 거절.
     *
     * 후보는 angtt 원글 작성 시 자동으로 pending 으로 들어온다. 여기서 사람이
     * 승인(근거 원글을 후기로 연결) · 편집 · 병합 · 거절한다.
     * 승인해도 자유게시판 자동 연결(auto_link)은 꺼진 채다 — 편집에서 따로 켠다.
     */
    import { onMount } from 'svelte';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import Plus from '@lucide/svelte/icons/plus';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import Film from '@lucide/svelte/icons/film';
    import {
        ENTITY_TYPES,
        ENTITY_TYPE_LABELS,
        defaultContextTerms,
        type EntityType
    } from '$lib/angtt-entity-presets';

    type Tab = 'pending' | 'active' | 'rejected';

    interface SourcePost {
        wrId: number;
        subject: string | null;
    }

    interface EntityItem {
        id: number;
        type: string;
        canonicalTitle: string;
        slug: string;
        aliases: string[];
        posterUrl: string | null;
        externalIds: Record<string, unknown>;
        meta: Record<string, unknown>;
        releaseDate: string | null;
        status: string;
        ratingCount: number;
        ratingAvg: number;
        reviewPostCount: number;
        linkCount: number;
        createdAt: string;
        sourcePosts: SourcePost[];
    }

    interface MergeTarget {
        id: number;
        title: string;
        slug: string;
        status: string;
    }

    interface TmdbItem {
        id: number;
        kind: 'movie' | 'tv';
        title: string;
        originalTitle: string;
        releaseDate: string;
        posterUrl: string | null;
        overview: string;
    }

    const TABS: { id: Tab; label: string }[] = [
        { id: 'pending', label: '대기' },
        { id: 'active', label: '활성' },
        { id: 'rejected', label: '거절' }
    ];

    let tab = $state<Tab>('pending');
    let items = $state<EntityItem[]>([]);
    let counts = $state<Record<string, number>>({});
    let tmdbEnabled = $state(false);
    let loading = $state(false);
    let busy = $state(false);
    let notice = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

    // ── 쪽·검색 (대기 후보가 수백 개라 서버에서 나눠 받는다) ──
    const PAGE_SIZE = 30;
    let pageNo = $state(1);
    let total = $state(0);
    let searchInput = $state('');
    let searchQuery = $state('');
    const pageCount = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

    // ── 편집·수동 등록 폼 ──
    let formOpen = $state(false);
    let formMode = $state<'edit' | 'create'>('edit');
    let form = $state({
        id: 0,
        title: '',
        slug: '',
        type: 'movie' as string,
        aliases: '',
        releaseDate: '',
        posterUrl: '',
        autoLink: false,
        contextTerms: '',
        tmdbId: '',
        tmdbKind: 'movie' as 'movie' | 'tv',
        status: 'active' as 'active' | 'pending'
    });

    // ── TMDB 검색 ──
    let tmdbQuery = $state('');
    let tmdbKind = $state<'movie' | 'tv'>('movie');
    let tmdbResults = $state<TmdbItem[]>([]);
    let tmdbLoading = $state(false);
    let tmdbError = $state('');

    // ── 병합 ──
    let mergeOpen = $state(false);
    let mergeSource = $state<EntityItem | null>(null);
    let mergeFilter = $state('');
    let mergeTargetId = $state(0);
    let mergeCandidates = $state<MergeTarget[]>([]);
    let mergeTimer: ReturnType<typeof setTimeout> | undefined;

    function typeLabel(type: string): string {
        return ENTITY_TYPE_LABELS[type as EntityType] ?? type;
    }

    async function api(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
        const res = await fetch(path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...init
        });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || body.success === false) {
            throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
        }
        return body;
    }

    function showError(err: unknown): void {
        notice = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
    }

    async function load(): Promise<void> {
        loading = true;
        try {
            // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 쿼리 문자열을 만들 때만 쓰는 임시 값이라 반응형이 필요 없다
            const params = new URLSearchParams({
                status: tab,
                page: String(pageNo),
                pageSize: String(PAGE_SIZE)
            });
            if (searchQuery) params.set('q', searchQuery);
            const body = await api(`/api/admin/angtt/entities?${params}`);
            items = (body.items as EntityItem[]) ?? [];
            counts = (body.counts as Record<string, number>) ?? {};
            total = Number(body.total ?? 0);
            tmdbEnabled = body.tmdbEnabled === true;
            // 마지막 쪽의 항목을 다 처리해 비었으면 한 쪽 앞으로
            const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (items.length === 0 && pageNo > lastPage) {
                pageNo = lastPage;
                await load();
            }
        } catch (err) {
            showError(err);
        } finally {
            loading = false;
        }
    }

    function selectTab(next: Tab): void {
        if (tab === next) return;
        tab = next;
        notice = null;
        pageNo = 1;
        load();
    }

    function runSearch(): void {
        searchQuery = searchInput.trim();
        pageNo = 1;
        load();
    }

    function clearSearch(): void {
        searchInput = '';
        if (!searchQuery) return;
        runSearch();
    }

    function goPage(next: number): void {
        const target = Math.min(pageCount, Math.max(1, next));
        if (target === pageNo) return;
        pageNo = target;
        load();
    }

    onMount(() => {
        load();
    });

    async function act(
        item: EntityItem,
        action: 'approve' | 'reject' | 'restore',
        question: string
    ): Promise<void> {
        if (!confirm(question)) return;
        busy = true;
        try {
            const body = await api(`/api/admin/angtt/entities/${item.id}`, {
                method: 'POST',
                body: JSON.stringify({ action })
            });
            const done =
                action === 'approve'
                    ? `「${item.canonicalTitle}」 승인 — 후기 ${Number(body.linked ?? 0)}개 연결`
                    : action === 'reject'
                      ? `「${item.canonicalTitle}」 거절`
                      : `「${item.canonicalTitle}」 대기로 되돌림`;
            notice = { kind: 'ok', text: done };
            await load();
        } catch (err) {
            showError(err);
        } finally {
            busy = false;
        }
    }

    function approve(item: EntityItem): void {
        act(
            item,
            'approve',
            `「${item.canonicalTitle}」 을(를) 승인할까요?\n근거 원글 ${item.sourcePosts.length}개가 후기로 연결됩니다. (자유게시판 자동 연결은 꺼진 채)`
        );
    }

    function reject(item: EntityItem): void {
        act(
            item,
            'reject',
            `「${item.canonicalTitle}」 을(를) 거절할까요?\n같은 제목으로는 후보가 다시 만들어지지 않습니다.`
        );
    }

    function restore(item: EntityItem): void {
        act(item, 'restore', `「${item.canonicalTitle}」 을(를) 대기로 되돌릴까요?`);
    }

    function seasonsOf(item: EntityItem): number[] {
        const v = item.meta?.seasons;
        return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
    }

    function asList(v: unknown): string[] {
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    }

    function openEdit(item: EntityItem): void {
        formMode = 'edit';
        const tmdb = Number(item.externalIds?.tmdb ?? 0);
        form = {
            id: item.id,
            title: item.canonicalTitle,
            slug: item.slug,
            type: item.type,
            aliases: item.aliases.join('\n'),
            releaseDate: item.releaseDate ?? '',
            posterUrl: item.posterUrl ?? '',
            autoLink: item.meta?.auto_link === true,
            contextTerms: asList(item.meta?.context_terms).join(', '),
            tmdbId: tmdb > 0 ? String(tmdb) : '',
            tmdbKind: item.externalIds?.tmdb_type === 'tv' ? 'tv' : 'movie',
            status: 'active'
        };
        resetTmdb(item.canonicalTitle, item.type);
        formOpen = true;
    }

    function openCreate(): void {
        formMode = 'create';
        form = {
            id: 0,
            title: '',
            slug: '',
            type: 'movie',
            aliases: '',
            releaseDate: '',
            posterUrl: '',
            autoLink: false,
            contextTerms: '',
            tmdbId: '',
            tmdbKind: 'movie',
            status: 'active'
        };
        resetTmdb('', 'movie');
        formOpen = true;
    }

    function resetTmdb(query: string, type: string): void {
        tmdbQuery = query;
        tmdbKind = type === 'movie' ? 'movie' : 'tv';
        tmdbResults = [];
        tmdbError = '';
    }

    function fillDefaultContextTerms(): void {
        form.contextTerms = defaultContextTerms(form.type).join(', ');
    }

    async function saveForm(): Promise<void> {
        busy = true;
        const payload = {
            canonicalTitle: form.title,
            slug: form.slug,
            type: form.type,
            aliases: form.aliases,
            releaseDate: form.releaseDate,
            posterUrl: form.posterUrl,
            autoLink: form.autoLink,
            contextTerms: form.contextTerms,
            tmdbId: form.tmdbId ? Number(form.tmdbId) : null,
            tmdbKind: form.tmdbKind
        };
        try {
            if (formMode === 'edit') {
                await api(`/api/admin/angtt/entities/${form.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                notice = { kind: 'ok', text: `「${form.title}」 저장됨` };
            } else {
                await api('/api/admin/angtt/entities', {
                    method: 'POST',
                    body: JSON.stringify({ ...payload, status: form.status })
                });
                notice = { kind: 'ok', text: `「${form.title}」 등록됨` };
            }
            formOpen = false;
            await load();
        } catch (err) {
            showError(err);
        } finally {
            busy = false;
        }
    }

    async function searchTmdb(): Promise<void> {
        const q = tmdbQuery.trim();
        if (!q) return;
        tmdbLoading = true;
        tmdbError = '';
        try {
            const body = await api(
                `/api/admin/angtt/tmdb?q=${encodeURIComponent(q)}&kind=${tmdbKind}`
            );
            tmdbResults = (body.results as TmdbItem[]) ?? [];
            if (tmdbResults.length === 0) tmdbError = '검색 결과가 없습니다.';
        } catch (err) {
            tmdbError = err instanceof Error ? err.message : String(err);
        } finally {
            tmdbLoading = false;
        }
    }

    /** TMDB 결과를 폼에 채운다 — 저장은 관리자가 확인 후 「저장」 */
    function pickTmdb(r: TmdbItem): void {
        if (r.posterUrl) form.posterUrl = r.posterUrl;
        if (r.releaseDate) form.releaseDate = r.releaseDate;
        form.tmdbId = String(r.id);
        form.tmdbKind = r.kind;
        if (!form.title.trim() && r.title) form.title = r.title;
        const names = form.aliases
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 함수 안에서만 쓰는 일회성 임시 값이라 반응형이 필요 없다
        const lower = new Set(names.map((n) => n.toLowerCase()));
        for (const n of [r.title, r.originalTitle]) {
            if (n && !lower.has(n.toLowerCase())) {
                names.push(n);
                lower.add(n.toLowerCase());
            }
        }
        form.aliases = names.join('\n');
        tmdbResults = [];
    }

    function openMerge(item: EntityItem): void {
        mergeSource = item;
        mergeFilter = '';
        mergeCandidates = [];
        mergeTargetId = 0;
        mergeOpen = true;
        loadMergeTargets();
    }

    /** 병합 대상 검색 — 활성 작품을 합칠 때는 활성 대상만 */
    async function loadMergeTargets(): Promise<void> {
        const source = mergeSource;
        if (!source) return;
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 쿼리 문자열을 만들 때만 쓰는 임시 값이라 반응형이 필요 없다
        const params = new URLSearchParams({ mode: 'targets', exclude: String(source.id) });
        if (mergeFilter.trim()) params.set('q', mergeFilter.trim());
        if (source.status === 'active') params.set('activeOnly', '1');
        try {
            const body = await api(`/api/admin/angtt/entities?${params}`);
            mergeCandidates = (body.targets as MergeTarget[]) ?? [];
            if (!mergeCandidates.some((t) => t.id === mergeTargetId)) mergeTargetId = 0;
        } catch (err) {
            showError(err);
        }
    }

    function onMergeFilterInput(): void {
        clearTimeout(mergeTimer);
        mergeTimer = setTimeout(loadMergeTargets, 250);
    }

    async function doMerge(): Promise<void> {
        const source = mergeSource;
        const target = mergeCandidates.find((t) => t.id === mergeTargetId);
        if (!source || !target) return;
        if (
            !confirm(
                `「${source.canonicalTitle}」 을(를) 「${target.title}」 에 병합할까요?\n연결 글·별점이 옮겨지고 되돌릴 수 없습니다.`
            )
        ) {
            return;
        }
        busy = true;
        try {
            const body = await api(`/api/admin/angtt/entities/${source.id}`, {
                method: 'POST',
                body: JSON.stringify({ action: 'merge', targetId: target.id })
            });
            notice = {
                kind: 'ok',
                text: `「${source.canonicalTitle}」 → 「${target.title}」 병합 (연결 ${Number(body.movedLinks ?? 0)}개, 별점 ${Number(body.movedRatings ?? 0)}개)`
            };
            mergeOpen = false;
            await load();
        } catch (err) {
            showError(err);
        } finally {
            busy = false;
        }
    }
</script>

<svelte:head>
    <title>앙티티 작품 관리 | Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-4 p-0 sm:p-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-foreground text-xl font-bold sm:text-2xl">앙티티 작품 관리</h1>
        <Button size="sm" onclick={openCreate}>
            <Plus class="h-4 w-4" />
            수동 등록
        </Button>
    </div>

    <p class="text-muted-foreground text-sm">
        앙티티 원글이 올라오면 제목에서 작품명을 뽑아 <b>대기</b> 후보로 넣습니다. 승인하면 근거 원글이
        작품 페이지의 후기로 연결됩니다. 자유게시판 자동 연결은 편집에서 따로 켭니다.
    </p>

    <div class="flex gap-1 border-b" role="tablist">
        {#each TABS as t (t.id)}
            <button
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors {tab ===
                t.id
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent'}"
                onclick={() => selectTab(t.id)}
            >
                {t.label}
                <span class="text-muted-foreground ml-1 text-xs tabular-nums"
                    >{counts[t.id] ?? 0}</span
                >
            </button>
        {/each}
    </div>

    {#if notice}
        <div
            class="rounded-md border px-3 py-2 text-sm {notice.kind === 'ok'
                ? 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-300'
                : 'border-destructive/40 bg-destructive/10 text-destructive'}"
            role="status"
        >
            {notice.text}
        </div>
    {/if}

    <form
        class="flex flex-wrap items-center gap-2"
        role="search"
        onsubmit={(e) => {
            e.preventDefault();
            runSearch();
        }}
    >
        <Input
            class="min-w-0 flex-1"
            bind:value={searchInput}
            placeholder="작품명·slug·별칭 검색"
            aria-label="작품 검색"
        />
        <Button size="sm" type="submit" variant="outline" disabled={loading}>검색</Button>
        {#if searchQuery}
            <Button size="sm" variant="ghost" onclick={clearSearch}>초기화</Button>
        {/if}
        <span class="text-muted-foreground w-full text-xs tabular-nums sm:w-auto">
            {searchQuery ? `「${searchQuery}」 ` : ''}{total}개
        </span>
    </form>

    {#if loading && items.length === 0}
        <p class="text-muted-foreground py-8 text-center text-sm">불러오는 중…</p>
    {:else if items.length === 0}
        <Card class="bg-background">
            <CardContent class="py-10 text-center">
                <Film class="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                <p class="text-muted-foreground text-sm">
                    {searchQuery ? '검색 결과가 없습니다.' : '이 탭에 작품이 없습니다.'}
                </p>
            </CardContent>
        </Card>
    {:else}
        <div class="space-y-3">
            {#each items as item (item.id)}
                <Card class="bg-background">
                    <CardContent class="flex flex-col gap-3 p-3 sm:flex-row sm:p-4">
                        {#if item.posterUrl}
                            <img
                                src={item.posterUrl}
                                alt=""
                                class="h-24 w-16 shrink-0 rounded object-cover"
                                loading="lazy"
                            />
                        {/if}
                        <div class="min-w-0 flex-1 space-y-1.5">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="text-foreground break-all font-semibold"
                                    >{item.canonicalTitle}</span
                                >
                                <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                                {#if item.meta?.auto_link === true}
                                    <Badge variant="outline">자동 연결 켜짐</Badge>
                                {/if}
                                {#if seasonsOf(item).length > 0}
                                    <Badge variant="outline">시즌 {seasonsOf(item).join('·')}</Badge
                                    >
                                {/if}
                            </div>
                            <div class="text-muted-foreground break-all text-xs">
                                /angtt/{item.slug}
                                {#if item.releaseDate}· {item.releaseDate}{/if}
                                · 등록 {item.createdAt}
                            </div>
                            {#if item.aliases.length > 0}
                                <div class="text-muted-foreground break-all text-xs">
                                    별칭: {item.aliases.join(', ')}
                                </div>
                            {/if}
                            {#if item.status === 'active'}
                                <div class="text-muted-foreground text-xs">
                                    연결 글 {item.linkCount} · 후기 {item.reviewPostCount} · 별점
                                    {item.ratingCount}명 ★{item.ratingAvg.toFixed(2)}
                                </div>
                            {/if}
                            {#if item.sourcePosts.length > 0}
                                <ul class="space-y-0.5 text-xs">
                                    {#each item.sourcePosts as sp (sp.wrId)}
                                        <li class="truncate">
                                            <a
                                                href="/angtt/{sp.wrId}"
                                                target="_blank"
                                                rel="noopener"
                                                class="text-primary inline-flex max-w-full items-center gap-1 hover:underline"
                                            >
                                                <ExternalLink class="h-3 w-3 shrink-0" />
                                                <span class="truncate"
                                                    >{sp.subject ?? `#${sp.wrId} (삭제된 글)`}</span
                                                >
                                            </a>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                        <div class="flex flex-wrap gap-1.5 sm:w-32 sm:flex-col sm:items-stretch">
                            {#if item.status === 'pending'}
                                <Button size="sm" disabled={busy} onclick={() => approve(item)}
                                    >승인</Button
                                >
                            {/if}
                            {#if item.status !== 'rejected'}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onclick={() => openEdit(item)}>편집</Button
                                >
                            {/if}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onclick={() => openMerge(item)}>병합</Button
                            >
                            {#if item.status === 'pending'}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="text-destructive"
                                    disabled={busy}
                                    onclick={() => reject(item)}>거절</Button
                                >
                            {/if}
                            {#if item.status === 'rejected'}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onclick={() => restore(item)}>대기로 되돌리기</Button
                                >
                            {/if}
                            {#if item.status === 'active'}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    href="/angtt/{encodeURIComponent(item.slug)}"
                                    target="_blank">페이지</Button
                                >
                            {/if}
                        </div>
                    </CardContent>
                </Card>
            {/each}
        </div>
    {/if}

    {#if total > PAGE_SIZE}
        <nav class="flex items-center justify-center gap-2 pt-1" aria-label="쪽 이동">
            <Button
                size="sm"
                variant="outline"
                disabled={loading || pageNo <= 1}
                onclick={() => goPage(pageNo - 1)}>이전</Button
            >
            <span class="text-muted-foreground text-sm tabular-nums">{pageNo} / {pageCount}</span>
            <Button
                size="sm"
                variant="outline"
                disabled={loading || pageNo >= pageCount}
                onclick={() => goPage(pageNo + 1)}>다음</Button
            >
        </nav>
    {/if}
</div>

<!-- 편집 · 수동 등록 -->
<Dialog.Root bind:open={formOpen}>
    <Dialog.Content class="max-h-[90vh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <Dialog.Header>
            <Dialog.Title>{formMode === 'edit' ? '작품 편집' : '작품 수동 등록'}</Dialog.Title>
            <Dialog.Description>
                저장해야 반영됩니다. 자유게시판 자동 연결은 문맥어와 함께 신중히 켜세요.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-3">
            {#if tmdbEnabled}
                <div class="bg-muted/40 space-y-2 rounded-md border p-3">
                    <Label for="tmdb-q">TMDB 검색</Label>
                    <div class="flex flex-wrap gap-2">
                        <Input
                            id="tmdb-q"
                            class="min-w-0 flex-1"
                            bind:value={tmdbQuery}
                            placeholder="작품명"
                            onkeydown={(e: KeyboardEvent) => {
                                if (e.key === 'Enter') searchTmdb();
                            }}
                        />
                        <select
                            bind:value={tmdbKind}
                            class="border-input bg-background h-9 rounded-md border px-2 text-sm"
                            aria-label="TMDB 검색 종류"
                        >
                            <option value="movie">영화</option>
                            <option value="tv">TV</option>
                        </select>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={tmdbLoading}
                            onclick={searchTmdb}>{tmdbLoading ? '검색 중…' : '검색'}</Button
                        >
                    </div>
                    {#if tmdbError}
                        <p class="text-muted-foreground text-xs">{tmdbError}</p>
                    {/if}
                    {#if tmdbResults.length > 0}
                        <ul class="space-y-1.5">
                            {#each tmdbResults as r (r.kind + r.id)}
                                <li>
                                    <button
                                        type="button"
                                        class="hover:bg-accent flex w-full items-start gap-2 rounded-md border p-2 text-left"
                                        onclick={() => pickTmdb(r)}
                                    >
                                        {#if r.posterUrl}
                                            <img
                                                src={r.posterUrl}
                                                alt=""
                                                class="h-16 w-11 shrink-0 rounded object-cover"
                                                loading="lazy"
                                            />
                                        {/if}
                                        <span class="min-w-0 text-sm">
                                            <span class="text-foreground block font-medium"
                                                >{r.title}</span
                                            >
                                            <span class="text-muted-foreground block text-xs"
                                                >{r.originalTitle} · {r.releaseDate ||
                                                    '날짜 없음'}</span
                                            >
                                        </span>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            {/if}

            <div>
                <Label for="f-title">작품명</Label>
                <Input id="f-title" bind:value={form.title} />
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <Label for="f-slug">slug (주소)</Label>
                    <Input
                        id="f-slug"
                        bind:value={form.slug}
                        placeholder={formMode === 'create' ? '비우면 자동' : ''}
                    />
                </div>
                <div>
                    <Label for="f-type">종류</Label>
                    <select
                        id="f-type"
                        bind:value={form.type}
                        class="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    >
                        {#each ENTITY_TYPES as t (t)}
                            <option value={t}>{ENTITY_TYPE_LABELS[t]}</option>
                        {/each}
                    </select>
                </div>
            </div>
            <div>
                <Label for="f-aliases">별칭 (한 줄에 하나)</Label>
                <Textarea id="f-aliases" rows={3} bind:value={form.aliases} />
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <Label for="f-date">개봉일</Label>
                    <Input id="f-date" type="date" bind:value={form.releaseDate} />
                </div>
                <div>
                    <Label for="f-tmdb">TMDB id</Label>
                    <Input id="f-tmdb" inputmode="numeric" bind:value={form.tmdbId} />
                </div>
            </div>
            <div>
                <Label for="f-poster">포스터 주소 (https)</Label>
                <Input id="f-poster" bind:value={form.posterUrl} />
            </div>
            <div class="space-y-1">
                <div class="flex items-center justify-between gap-2">
                    <Label for="f-context">자동 연결 문맥어 (쉼표 구분)</Label>
                    <Button size="sm" variant="ghost" onclick={fillDefaultContextTerms}
                        >기본값</Button
                    >
                </div>
                <Textarea id="f-context" rows={2} bind:value={form.contextTerms} />
            </div>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={form.autoLink} class="h-4 w-4" />
                자유게시판 글 제목 자동 연결 켜기
            </label>
            {#if formMode === 'create'}
                <label class="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.status === 'pending'}
                        onchange={(e) =>
                            (form.status = (e.currentTarget as HTMLInputElement).checked
                                ? 'pending'
                                : 'active')}
                        class="h-4 w-4"
                    />
                    대기 상태로 등록 (체크 안 하면 바로 활성)
                </label>
            {/if}
        </div>

        <Dialog.Footer class="gap-2">
            <Button variant="outline" onclick={() => (formOpen = false)}>취소</Button>
            <Button disabled={busy} onclick={saveForm}>{busy ? '저장 중…' : '저장'}</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- 병합 -->
<Dialog.Root bind:open={mergeOpen}>
    <Dialog.Content class="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <Dialog.Header>
            <Dialog.Title>병합</Dialog.Title>
            <Dialog.Description>
                「{mergeSource?.canonicalTitle}」 을(를) 합칠 작품을 고르세요. 별칭·연결 글·별점이
                옮겨집니다.
            </Dialog.Description>
        </Dialog.Header>
        <div class="space-y-2">
            <Input
                bind:value={mergeFilter}
                oninput={onMergeFilterInput}
                placeholder="작품명·slug·별칭 검색"
            />
            {#if mergeSource?.status === 'active'}
                <p class="text-muted-foreground text-xs">
                    활성 작품은 활성 작품에만 합칠 수 있습니다.
                </p>
            {/if}
            <ul class="max-h-64 space-y-1 overflow-y-auto">
                {#each mergeCandidates as t (t.id)}
                    <li>
                        <label
                            class="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                        >
                            <input
                                type="radio"
                                name="merge-target"
                                value={t.id}
                                bind:group={mergeTargetId}
                            />
                            <span class="min-w-0 flex-1 truncate">{t.title}</span>
                            <Badge variant={t.status === 'active' ? 'default' : 'secondary'}
                                >{t.status === 'active' ? '활성' : '대기'}</Badge
                            >
                        </label>
                    </li>
                {:else}
                    <li class="text-muted-foreground px-2 py-3 text-sm">대상이 없습니다.</li>
                {/each}
            </ul>
        </div>
        <Dialog.Footer class="gap-2">
            <Button variant="outline" onclick={() => (mergeOpen = false)}>취소</Button>
            <Button disabled={busy || !mergeTargetId} onclick={doMerge}>병합</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
