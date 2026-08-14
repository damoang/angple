<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Progress } from '$lib/components/ui/progress/index.js';
    import type { PageData } from './$types.js';
    import type { MyComment } from '$lib/api/types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { getGradeName } from '$lib/utils/grade.js';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import MySkeleton from '$lib/components/features/my/my-skeleton.svelte';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Heart from '@lucide/svelte/icons/heart';
    import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
    import User from '@lucide/svelte/icons/user';
    import Trash2 from '@lucide/svelte/icons/trash-2';

    let { data }: { data: PageData } = $props();

    let myAvatarUrl = $derived(
        getAvatarUrl(authStore.user?.mb_image, authStore.user?.mb_image_updated_at) || null
    );
    let myAvatarFailed = $state(false);

    $effect(() => {
        if (authStore.user) myAvatarFailed = false;
    });

    // 탭 정의
    const tabs = [
        { id: 'posts', label: '내가 쓴 글', icon: FileText },
        { id: 'comments', label: '내가 쓴 댓글', icon: MessageSquare },
        { id: 'liked', label: '공감한 글', icon: Heart },
        { id: 'stats', label: '전체분석', icon: BarChart3 }
    ];

    // 검색 (bug/12292) — 글·댓글 탭에서만
    const canSearch = $derived(data.tab === 'posts' || data.tab === 'comments');
    let searchInput = $state(data.q ?? '');

    // ⛔ 평범한 let. $state 로 두고 아래 $effect 에서 읽고 쓰면 자기 재트리거가 난다
    //    (2026-08-01 auth 429 사고). 여기서는 data.q 만 읽고 searchInput 에 쓴다.
    let lastAppliedQ = data.q ?? '';
    $effect(() => {
        const q = data.q ?? '';
        if (q !== lastAppliedQ) {
            lastAppliedQ = q;
            searchInput = q;
        }
    });

    function buildMyUrl(opts: {
        tab?: string;
        page?: number;
        q?: string;
        filter?: string;
    }): string {
        const tab = opts.tab ?? data.tab;
        const q = opts.q ?? data.q ?? '';
        // 삭제 필터(bug/13341 후속): 페이지 이동에선 유지, 탭 전환에선 해제.
        // 명시적 선택을 넘어 따라다니면 "글이 다 사라졌다" 오인을 만든다.
        const filter = opts.filter ?? (opts.tab === undefined ? (data.filter ?? '') : '');
        const params = new URLSearchParams({ tab });
        // 검색어는 글·댓글 탭에서만 의미가 있다.
        if (q && (tab === 'posts' || tab === 'comments')) params.set('q', q);
        if (filter === 'deleted') params.set('filter', 'deleted');
        if (opts.page && opts.page > 1) params.set('page', String(opts.page));
        return `/my?${params}`;
    }

    // 탭 변경 — 검색어는 유지한다. 같은 말을 글에서도 댓글에서도 찾는 게 자연스럽다.
    function changeTab(tabId: string): void {
        goto(buildMyUrl({ tab: tabId }));
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(buildMyUrl({ page: pageNum }));
    }

    // ⛔ 검색 시 page 를 1 로 되돌린다. 안 그러면 3페이지에서 검색해 결과가 0건이 된다.
    function submitSearch(): void {
        goto(buildMyUrl({ q: searchInput.trim(), page: 1 }));
    }

    function clearSearch(): void {
        searchInput = '';
        goto(buildMyUrl({ q: '', page: 1 }));
    }

    // 날짜 포맷
    function stripHtml(html: string): string {
        // 이중 인코딩 대응: &amp;lt; → &lt; → < 순서로 반복 디코딩
        let result = html;
        let prev;
        do {
            prev = result;
            result = result
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ');
        } while (result !== prev);
        return result.replace(/<[^>]*>/g, '').trim();
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function getAdvertiserStatusLabel(status?: string): string {
        switch (status) {
            case 'ongoing':
                return '진행중';
            case 'expired':
                return '만료됨';
            case 'scheduled':
                return '예정';
            case 'inactive':
                return '비활성';
            default:
                return '';
        }
    }

    function getMyPostTitle(post: { title: string; deleted_at?: string | null }): string {
        return post.deleted_at ? '삭제된 글입니다.' : post.title;
    }

    function getMyCommentContent(comment: {
        content: string;
        deleted_at?: string | null;
        post_deleted_at?: string | null;
    }): string {
        if (comment.deleted_at) return '삭제된 댓글입니다.';
        if (comment.post_deleted_at) return `[삭제된 글] ${stripHtml(comment.content)}`;
        return stripHtml(comment.content);
    }

    // bug/13518 Part 2: 마이페이지에서 내 댓글 직접 삭제.
    // 상세 페이지의 삭제 UI 는 부모 글이 404/잠금이면 닿을 수 없다. 반면 삭제 엔드포인트
    // (/api/boards/[boardId]/posts/[postId]/comments/[commentId])는 "댓글 소유자"만 확인하고
    // 부모 글 접근성은 요구하지 않으므로, 여기서 그 엔드포인트를 그대로 재사용한다.
    // 낙관적 처리: 성공한 댓글 key 를 모아 목록에서 숨기고 카운트를 줄인다.
    function commentKey(c: { board_id: string; id: number | string }): string {
        return `${c.board_id}-${c.id}`;
    }

    let deletedKeys = $state<string[]>([]);
    let deletingKey = $state<string | null>(null);

    // 탭/페이지/필터/검색이 바뀌면 낙관적 삭제 표시를 초기화한다.
    // ⛔ 이 $state(deletedKeys) 를 읽고 쓰면 자기 재트리거가 나므로, 여기서는 URL 파생값만
    //    읽고 lastListSig(평범한 let)로 변화를 감지한다(위 searchInput 패턴과 동일).
    let lastListSig = `${data.tab}|${data.page}|${data.filter}|${data.q}`;
    $effect(() => {
        const sig = `${data.tab}|${data.page}|${data.filter}|${data.q}`;
        if (sig !== lastListSig) {
            lastListSig = sig;
            deletedKeys = [];
        }
    });

    async function deleteMyComment(comment: MyComment): Promise<void> {
        const key = commentKey(comment);
        if (deletedKeys.includes(key) || deletingKey) return;

        // 삭제 엔드포인트는 부모 글(wr_parent) 기준으로 댓글을 찾는다.
        const parentPostId = comment.post_id || comment.parent_id;
        if (!comment.board_id || !parentPostId || !comment.id) return;

        // 되돌릴 수 없으므로 반드시 확인을 받는다(일괄 삭제 없음 — 한 건씩).
        if (!confirm('이 댓글을 삭제할까요? 삭제한 댓글은 되돌릴 수 없습니다.')) return;

        deletingKey = key;
        try {
            const res = await fetch(
                `/api/boards/${comment.board_id}/posts/${parentPostId}/comments/${comment.id}`,
                { method: 'DELETE' }
            );
            if (res.ok) {
                deletedKeys = [...deletedKeys, key];
            } else {
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                alert(body.error || '댓글 삭제에 실패했습니다.');
            }
        } catch {
            alert('댓글 삭제에 실패했습니다.');
        } finally {
            deletingKey = null;
        }
    }
</script>

<svelte:head>
    <title>마이페이지 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4">
    <!-- 헤더 (즉시 렌더링: locals.user에서 옴) -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
            {#if authStore.user}
                <div
                    class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold {myAvatarUrl &&
                    !myAvatarFailed
                        ? 'overflow-hidden'
                        : 'bg-primary text-primary-foreground'}"
                >
                    {#if myAvatarUrl && !myAvatarFailed}
                        <img
                            src={myAvatarUrl}
                            alt={authStore.user.mb_name}
                            class="h-full w-full object-cover"
                            onerror={() => {
                                myAvatarFailed = true;
                            }}
                        />
                    {:else}
                        {authStore.user.mb_name.charAt(0).toUpperCase()}
                    {/if}
                </div>
                <div>
                    <h1 class="text-foreground text-2xl font-bold">{authStore.user.mb_name}</h1>
                    <div class="flex items-center gap-1.5">
                        {#if authStore.user.as_level}
                            <LevelBadge level={authStore.user.as_level} />
                        {/if}
                        <p class="text-secondary-foreground">
                            {getGradeName(authStore.user.mb_level)}
                        </p>
                    </div>
                    <!-- 등급 승급 경로 안내 (hello/27814: 배지≠등급 착시) — mb_level 기준 -->
                    {#if authStore.user.mb_level >= 1 && authStore.user.mb_level < 3}
                        <p class="text-muted-foreground mt-0.5 text-xs">
                            현재 등급: {getGradeName(authStore.user.mb_level)} · 매일 출석 7일이면 자동으로
                            앙님💛 (숫자 배지는 활동 레벨이에요)
                        </p>
                    {/if}
                    {#if authStore.user.mb_id}
                        <p class="text-muted-foreground mt-0.5 text-sm">
                            아이디 {authStore.user.mb_id}
                        </p>
                    {/if}
                    {#if authStore.user.mb_level === 5}
                        <div class="mt-1 text-sm">
                            <span class="text-muted-foreground">광고 종료일</span>
                            <span class="ml-2 font-medium">
                                {authStore.user.advertiser_end_date || '-'}
                            </span>
                            {#if getAdvertiserStatusLabel(authStore.user.advertiser_status)}
                                <span class="text-muted-foreground ml-2">
                                    {getAdvertiserStatusLabel(authStore.user.advertiser_status)}
                                </span>
                            {/if}
                        </div>
                    {/if}
                    <!-- 경험치 게이지: 스트리밍 데이터 도착 후 표시 -->
                    {#await data.streamed?.tabData then result}
                        {#if result.expSummary}
                            <div class="mt-1 w-48">
                                <div
                                    class="text-muted-foreground mb-0.5 flex items-center justify-between text-xs"
                                >
                                    <span>Lv.{result.expSummary.current_level}</span>
                                    <span>{result.expSummary.level_progress}%</span>
                                </div>
                                <Progress
                                    value={result.expSummary.level_progress}
                                    max={100}
                                    class="h-2"
                                />
                                <p class="text-muted-foreground mt-0.5 text-xs">
                                    {result.expSummary.total_exp.toLocaleString()} / {result.expSummary.next_level_exp.toLocaleString()}
                                    XP
                                </p>
                            </div>
                        {/if}
                    {/await}
                </div>
            {:else}
                <div class="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
                    <User class="text-muted-foreground h-8 w-8" />
                </div>
                <div>
                    <h1 class="text-foreground text-2xl font-bold">마이페이지</h1>
                </div>
            {/if}
        </div>
    </div>

    <!-- 탭 네비게이션 (즉시 렌더링) -->
    <div
        class="border-border -mx-4 mb-6 flex gap-2 overflow-x-auto whitespace-nowrap border-b px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
        {#each tabs as tab (tab.id)}
            <Button
                variant={data.tab === tab.id ? 'default' : 'ghost'}
                size="sm"
                class="shrink-0"
                onclick={() => changeTab(tab.id)}
            >
                <tab.icon class="mr-1.5 h-4 w-4" />
                {tab.label}
            </Button>
        {/each}
    </div>

    <!-- 검색 (글·댓글 탭 전용) — bug/12292 -->
    {#if canSearch}
        <form
            class="mb-4"
            onsubmit={(e) => {
                e.preventDefault();
                submitSearch();
            }}
        >
            <div class="flex gap-2">
                <input
                    type="search"
                    bind:value={searchInput}
                    placeholder={data.tab === 'posts' ? '내가 쓴 글 검색' : '내가 쓴 댓글 검색'}
                    aria-label={data.tab === 'posts' ? '내가 쓴 글 검색' : '내가 쓴 댓글 검색'}
                    class="border-input bg-background focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
                <Button type="submit" size="sm" class="shrink-0">찾기</Button>
                {#if data.q}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="shrink-0"
                        onclick={clearSearch}>지우기</Button
                    >
                {/if}
            </div>
            <!-- ⛔ 한계를 숨기지 않는다. content_preview 가 255자라 긴 글의 뒷부분은 찾히지
                 않는다. 안 적으면 "왜 안 나오지"가 된다. -->
            <p class="text-muted-foreground mt-1.5 text-xs">
                {data.tab === 'posts'
                    ? '제목과 본문 앞부분에서 찾습니다.'
                    : '댓글 내용과 원글 제목에서 찾습니다.'}
            </p>
        </form>
    {/if}

    <!-- 탭 콘텐츠 (스트리밍) -->
    {#await data.streamed?.tabData}
        <!-- 스켈레톤 -->
        <MySkeleton />
    {:then result}
        <!-- 에러 메시지 -->
        {#if result.error}
            <Card class="border-destructive">
                <CardContent class="pt-6">
                    <p class="text-destructive text-center">{result.error}</p>
                </CardContent>
            </Card>
        {:else}
            <!-- 내가 쓴 글 -->
            {#if data.tab === 'posts'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <FileText class="h-5 w-5" />
                            내가 쓴 글
                            {#if result.posts}
                                <span class="text-muted-foreground text-sm font-normal">
                                    ({result.posts.total}개)
                                </span>
                            {/if}
                            <!-- bug/13341 후속: 삭제한 글도 본인은 볼 수 있어야 한다 -->
                            <span class="ml-auto flex gap-1 text-sm font-normal">
                                <Button
                                    variant={data.filter === 'deleted' ? 'ghost' : 'secondary'}
                                    size="sm"
                                    class="h-7 px-2 text-xs"
                                    onclick={() => goto(buildMyUrl({ tab: data.tab, filter: '' }))}
                                >
                                    남은 글
                                </Button>
                                <Button
                                    variant={data.filter === 'deleted' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    class="h-7 px-2 text-xs"
                                    onclick={() =>
                                        goto(buildMyUrl({ tab: data.tab, filter: 'deleted' }))}
                                >
                                    삭제한 글
                                </Button>
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.posts && result.posts.items.length > 0}
                            <ul class="divide-border divide-y">
                                {#each result.posts.items as post (post.id)}
                                    <li class="py-3 first:pt-0 last:pb-0">
                                        <!-- bug/13518 Part 3: 삭제한 글도 작성자 본인은 열 수 있다.
                                             백엔드 GET posts/:id 는 FindPostByIDIncludeDeleted 로
                                             삭제글을 200(본문 마스킹)으로 내려주고, 상세 페이지는
                                             404 가 아니라 마스킹 렌더한다. #13174 서버 마스킹으로
                                             본문 유출은 없고, 자진삭제 글은 댓글 스레드가 남아 본인이
                                             논의를 확인할 수 있으므로 링크를 복원한다.
                                             삭제글은 opacity-70 으로 시각적으로 구분한다. -->
                                        <a
                                            href="/{post.board_id || 'free'}/{post.id}"
                                            class="{post.deleted_at
                                                ? 'opacity-70'
                                                : 'hover:bg-accent'} -m-2 block w-full rounded-md p-2 no-underline transition-colors"
                                        >
                                            <h3
                                                class="text-foreground mb-1 line-clamp-1 font-medium"
                                            >
                                                {getMyPostTitle(post)}
                                            </h3>
                                            <div
                                                class="text-muted-foreground flex items-center gap-2 text-xs"
                                            >
                                                <span>{formatDate(post.created_at)}</span>
                                                <span>·</span>
                                                <span>조회 {post.views.toLocaleString()}</span>
                                                <span>·</span>
                                                <span>공감 {post.likes}</span>
                                                <span>·</span>
                                                <span>댓글 {post.comments_count}</span>
                                                {#if post.deleted_at}
                                                    <span>·</span>
                                                    <span class="text-destructive/70"
                                                        >삭제 {formatDate(post.deleted_at)}</span
                                                    >
                                                {/if}
                                            </div>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                {#if data.q}
                                    '{data.q}'에 해당하는 글이 없습니다.
                                {:else if data.filter === 'deleted'}
                                    삭제한 글이 없습니다.
                                {:else}
                                    작성한 글이 없습니다.
                                {/if}
                            </p>
                        {/if}
                    </CardContent>
                </Card>

                <!-- 페이지네이션 -->
                {#if result.posts && result.posts.total_pages > 1}
                    {@const pag = result.posts}
                    <div class="mt-6 flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === 1}
                            onclick={() => goToPage(data.page - 1)}
                        >
                            이전
                        </Button>
                        <span class="text-muted-foreground px-4 text-sm">
                            {data.page} / {pag.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === pag.total_pages}
                            onclick={() => goToPage(data.page + 1)}
                        >
                            다음
                        </Button>
                    </div>
                {/if}
            {/if}

            <!-- 내가 쓴 댓글 -->
            {#if data.tab === 'comments'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <MessageSquare class="h-5 w-5" />
                            내가 쓴 댓글
                            {#if result.comments}
                                <span class="text-muted-foreground text-sm font-normal">
                                    <!-- bug/13518 Part 2: 방금 삭제한 건 반영 -->
                                    ({Math.max(result.comments.total - deletedKeys.length, 0)}개)
                                </span>
                            {/if}
                            <span class="ml-auto flex gap-1 text-sm font-normal">
                                <Button
                                    variant={data.filter === 'deleted' ? 'ghost' : 'secondary'}
                                    size="sm"
                                    class="h-7 px-2 text-xs"
                                    onclick={() => goto(buildMyUrl({ tab: data.tab, filter: '' }))}
                                >
                                    남은 댓글
                                </Button>
                                <Button
                                    variant={data.filter === 'deleted' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    class="h-7 px-2 text-xs"
                                    onclick={() =>
                                        goto(buildMyUrl({ tab: data.tab, filter: 'deleted' }))}
                                >
                                    삭제한 댓글
                                </Button>
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.comments && result.comments.items.length > 0}
                            <ul class="divide-border divide-y">
                                {#each result.comments.items as comment (`${comment.board_id}-${comment.id}`)}
                                    {@const key = `${comment.board_id}-${comment.id}`}
                                    <li class="py-3 first:pt-0 last:pb-0">
                                        {#if deletedKeys.includes(key)}
                                            <!-- bug/13518 Part 2: 방금 삭제한 댓글 자리 표시 -->
                                            <p class="text-muted-foreground -m-2 p-2 text-sm">
                                                삭제된 댓글입니다.
                                            </p>
                                        {:else}
                                            <div class="flex items-start gap-2">
                                                <a
                                                    href="/{comment.board_id ||
                                                        'free'}/{comment.post_id ||
                                                        comment.parent_id}#c_{comment.id}"
                                                    class="hover:bg-accent -m-2 block min-w-0 flex-1 rounded-md p-2 no-underline transition-colors"
                                                >
                                                    {#if comment.post_title}
                                                        <p
                                                            class="text-muted-foreground mb-1 line-clamp-1 text-xs"
                                                        >
                                                            {comment.post_title}
                                                        </p>
                                                    {/if}
                                                    <p class="text-foreground mb-2 line-clamp-2">
                                                        {getMyCommentContent(comment)}
                                                    </p>
                                                    <div
                                                        class="text-muted-foreground flex items-center gap-2 text-xs"
                                                    >
                                                        <span>{formatDate(comment.created_at)}</span
                                                        >
                                                        {#if comment.likes}
                                                            <span>·</span>
                                                            <span>공감 {comment.likes}</span>
                                                        {/if}
                                                    </div>
                                                </a>
                                                <!-- bug/13518 Part 2: 이미 삭제된 댓글엔 버튼을 숨긴다 -->
                                                {#if !comment.deleted_at}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        class="text-muted-foreground hover:text-destructive h-8 shrink-0 px-2"
                                                        disabled={deletingKey === key}
                                                        aria-label="댓글 삭제"
                                                        onclick={() => deleteMyComment(comment)}
                                                    >
                                                        <Trash2 class="h-4 w-4" />
                                                    </Button>
                                                {/if}
                                            </div>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                {#if data.q}
                                    '{data.q}'에 해당하는 댓글이 없습니다.
                                {:else}
                                    작성한 댓글이 없습니다.
                                {/if}
                            </p>
                        {/if}
                    </CardContent>
                </Card>

                {#if result.comments && result.comments.total_pages > 1}
                    {@const pag = result.comments}
                    <div class="mt-6 flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === 1}
                            onclick={() => goToPage(data.page - 1)}
                        >
                            이전
                        </Button>
                        <span class="text-muted-foreground px-4 text-sm">
                            {data.page} / {pag.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === pag.total_pages}
                            onclick={() => goToPage(data.page + 1)}
                        >
                            다음
                        </Button>
                    </div>
                {/if}
            {/if}

            <!-- 공감한 글 -->
            {#if data.tab === 'liked'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <Heart class="h-5 w-5" />
                            공감한 글
                            {#if result.likedPosts}
                                <span class="text-muted-foreground text-sm font-normal">
                                    ({result.likedPosts.total}개)
                                </span>
                            {/if}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.likedPosts && result.likedPosts.items.length > 0}
                            <ul class="divide-border divide-y">
                                {#each result.likedPosts.items as post (post.id)}
                                    <li>
                                        <a
                                            href="/{post.board_id || 'free'}/{post.id}"
                                            class="hover:bg-muted flex items-center gap-2.5 px-4 py-2 no-underline transition-all duration-200 ease-out"
                                        >
                                            <span
                                                class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
                                            >
                                                {post.board_id || 'free'}
                                            </span>
                                            <span class="min-w-0 flex-1 truncate leading-relaxed">
                                                {post.title}
                                            </span>
                                            <span
                                                class="text-muted-foreground hidden shrink-0 items-center gap-3 text-xs sm:flex"
                                            >
                                                <span>{post.author}</span>
                                                <span>{formatDate(post.created_at)}</span>
                                            </span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                공감한 글이 없습니다.
                            </p>
                        {/if}
                    </CardContent>
                </Card>

                {#if result.likedPosts && result.likedPosts.total_pages > 1}
                    {@const pag = result.likedPosts}
                    <div class="mt-6 flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === 1}
                            onclick={() => goToPage(data.page - 1)}
                        >
                            이전
                        </Button>
                        <span class="text-muted-foreground px-4 text-sm">
                            {data.page} / {pag.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === pag.total_pages}
                            onclick={() => goToPage(data.page + 1)}
                        >
                            다음
                        </Button>
                    </div>
                {/if}
            {/if}

            <!-- 전체분석 -->
            {#if data.tab === 'stats'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <BarChart3 class="h-5 w-5" />
                            전체분석
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.boardStats && result.boardStats.length > 0}
                            <div class="divide-border divide-y">
                                {#each result.boardStats as stat (stat.board_id)}
                                    <div class="flex items-center justify-between py-3">
                                        <a
                                            href="/{stat.board_id}"
                                            class="text-foreground font-medium hover:underline"
                                        >
                                            {stat.board_name}
                                        </a>
                                        <div class="text-muted-foreground flex gap-4 text-sm">
                                            <span>글 {stat.post_count}</span>
                                            <span>댓글 {stat.comment_count}</span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                활동 내역이 없습니다.
                            </p>
                        {/if}
                    </CardContent>
                </Card>
            {/if}
        {/if}
    {:catch}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">데이터를 불러오는데 실패했습니다.</p>
            </CardContent>
        </Card>
    {/await}
</div>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        line-clamp: 1;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-2 {
        display: -webkit-box;
        line-clamp: 2;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
