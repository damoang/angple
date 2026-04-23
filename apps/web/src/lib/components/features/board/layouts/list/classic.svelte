<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Play from '@lucide/svelte/icons/play';
    import Pin from '@lucide/svelte/icons/pin';
    import Heart from '@lucide/svelte/icons/heart';
    import Avatar from '$lib/components/ui/Avatar.svelte';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { formatDate, formatDateCompact, isToday } from '$lib/utils/format-date.js';
    import { formatCompactNumber } from '$lib/utils/format-number.js';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { readPostStyleStore } from '$lib/stores/read-post-style.svelte.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import { formatCommentCountBadge } from '$lib/utils/comment-count.js';
    // 메모 플러그인
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));

    // Props
    let {
        post,
        displaySettings,
        href,
        isRead = false,
        memo = null,
        searchQuery = ''
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
        memo?: { content: string; color: string } | null;
        searchQuery?: string;
    } = $props();

    function highlightText(text: string): string {
        if (!searchQuery || !text) return text;
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped.replace(
            new RegExp(`(${q})`, 'gi'),
            '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>'
        );
    }

    /**
     * 추천 색상 단계 — 레거시 rcmd-box 기반
     * step0 (0): 거의 투명 bg, 20% opacity 텍스트
     * step1 (1-5): 회색 bg 20%
     * step2 (6-10): 파랑 bg 30%
     * step3 (11-50): 파랑 bg 60%
     * step4 (50+): 파랑 bg 75%, 흰색 텍스트
     */
    const likesStepStyle = $derived.by(() => {
        const likes = post.likes;
        if (likes === 0) {
            // step0: foreground at 4%/20% — adapts to light & dark via CSS variable
            return 'background: color-mix(in oklch, var(--foreground) 4%, transparent); color: color-mix(in oklch, var(--foreground) 20%, transparent);';
        } else if (likes <= 5) {
            // step1: rgba(172,172,172, 0.2) bg
            return 'background: rgba(172,172,172,0.2); color: var(--color-foreground);';
        } else if (likes <= 10) {
            // step2: rgba(59,130,246, 0.3) bg
            return 'background: rgba(59,130,246,0.3); color: var(--color-foreground);';
        } else if (likes <= 50) {
            // step3: rgba(59,130,246, 0.6) bg
            return 'background: rgba(59,130,246,0.6); color: var(--color-foreground);';
        } else {
            // step4: rgba(0,102,255, 0.75) bg, white text
            return 'background: rgba(0,102,255,0.75); color: #fff;';
        }
    });

    // 삭제된 글
    const isDeleted = $derived(!!post.deleted_at);

    // 새글 (24시간 이내)
    const isNew = $derived.by(() => {
        if (!post.created_at) return false;
        const created = new Date(post.created_at).getTime();
        const now = Date.now();
        return now - created < 24 * 60 * 60 * 1000;
    });

    // 목록 summary 응답은 raw URL 대신 불린 플래그만 내려준다.
    const hasVideo = $derived(post.has_video ?? !!post.extra_9);

    // 이미지 첨부 여부
    const hasImage = $derived(
        post.has_image ??
            !!(post.has_file || (post.images && post.images.length > 0) || post.extra_10)
    );

    // 홍보 게시글 여부
    const isPromo = $derived(post.category === '홍보');

    // 읽은 글 CSS 클래스
    const readClass = $derived(
        isRead ? `post-title-read-${readPostStyleStore.value}` : 'post-title'
    );

    // 모바일 추천 텍스트 색상 (작은 인라인 텍스트용)
    const mobileLikesClass = $derived.by(() => {
        const likes = post.likes;
        if (likes === 0) return 'text-muted-foreground/30';
        if (likes <= 4) return 'text-muted-foreground';
        if (likes <= 9) return 'text-foreground/60';
        return 'mobile-likes-hot';
    });

    // 모바일 10+ 추천 시 pill 배지 스타일
    const mobileLikesPill = $derived(post.likes >= 10);

    // 모던 보기: 데스크탑에서도 모바일 레이아웃 강제 적용
    const isMobileView = $derived(uiSettingsStore.listView === 'modern');
</script>

<!-- Classic 스킨: 데스크톱 CSS Grid 5컬럼 (추천|제목|이름|날짜|조회) -->
{#if isDeleted}
    <a
        {href}
        class="bg-background hover:bg-accent block cursor-pointer px-4 py-1.5 no-underline opacity-50"
    >
        <div class="flex items-center gap-2 md:gap-3">
            <div class="hidden shrink-0 md:block">
                <div
                    class="flex min-h-5 min-w-10 items-center justify-center rounded-lg text-xs font-semibold"
                    style="background: color-mix(in oklch, var(--foreground) 4%, transparent); color: color-mix(in oklch, var(--foreground) 20%, transparent);"
                >
                    -
                </div>
            </div>
            <div class="min-w-0 flex-1">
                <span class="text-muted-foreground" style="font-size: var(--list-font-size);"
                    >[삭제된 게시물입니다]</span
                >
            </div>
        </div>
    </a>
{:else}
    <a
        {href}
        class="post-row bg-background hover:bg-accent block px-4 no-underline transition-colors"
        class:post-promo={isPromo}
        class:post-notice={post.is_notice}
    >
        <div
            class={isMobileView
                ? 'flex items-center gap-2'
                : 'flex items-center gap-2 md:grid md:grid-cols-[60px_1fr_auto_auto_auto] md:items-center md:gap-0'}
        >
            <!-- 추천 박스 (col 1, 데스크톱만) — legacy: rcmd-box 40×20 rounded-lg -->
            <div
                class={isMobileView ? 'hidden' : 'hidden md:flex md:items-center md:justify-center'}
            >
                {#if post.is_notice}
                    <div
                        class="flex min-h-5 min-w-10 items-center justify-center rounded-lg"
                        style="background: rgba(239,68,68,0.1);"
                    >
                        <Pin class="h-3.5 w-3.5" style="color: rgb(239,68,68);" />
                    </div>
                {:else}
                    <div
                        class="flex min-h-5 min-w-10 items-center justify-center rounded-lg text-xs font-semibold"
                        style={likesStepStyle}
                    >
                        {post.likes.toLocaleString()}
                    </div>
                {/if}
            </div>

            <!-- 콘텐츠 (모바일: block, 데스크톱: contents → 그리드 col 2~5 참여) -->
            <div
                class={isMobileView
                    ? 'min-w-0 flex-1 space-y-1'
                    : 'min-w-0 flex-1 space-y-1 md:contents md:space-y-0'}
            >
                <!-- 제목 줄 (col 2) -->
                <div class="flex min-w-0 items-center gap-1">
                    {#if post.is_notice}
                        <span class="mobile-only" class:modern-view={isMobileView}
                            ><Pin class="text-liked h-3.5 w-3.5 shrink-0" /></span
                        >
                    {/if}
                    {#if post.is_adult}
                        <Badge variant="destructive" class="shrink-0 px-1 py-0 text-[10px]"
                            >19</Badge
                        >
                    {/if}
                    {#if post.scheduled_delete_at}
                        <Badge
                            variant="outline"
                            class="shrink-0 border-amber-300 bg-amber-50 px-1 py-0 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            title={`삭제 예정: ${post.scheduled_delete_at}`}>삭제예정</Badge
                        >
                    {/if}
                    {#if post.is_secret}
                        <Lock class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    {/if}
                    {#if post.category}
                        <span
                            class="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0 text-xs font-medium"
                        >
                            {post.category}
                        </span>
                    {/if}
                    <!-- 제목 + 부가 아이콘 wrapper: min-w-0으로 truncate 강제 -->
                    <span class="inline-flex min-w-0 flex-1 items-center gap-1">
                        <span
                            class="truncate {readClass}"
                            class:font-semibold={uiSettingsStore.titleBold}
                        >
                            {#if post.report_count === 'lock'}
                                <span class="text-muted-foreground italic"
                                    >신고에 의해 숨겨진 게시글입니다</span
                                >
                            {:else if searchQuery}
                                {@html highlightText(post.title)}
                            {:else}
                                {post.title}
                            {/if}
                        </span>
                        {#if isNew}
                            <span class="text-liked shrink-0 text-[10px] font-bold">N</span>
                        {/if}
                        {#if hasVideo}
                            <Play class="text-destructive h-3.5 w-3.5 shrink-0" />
                        {:else if hasImage}
                            <ImageIcon class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        {/if}
                        {#if post.comments_count > 0 && !post.is_comments_disabled}
                            <a
                                href="{href}#comments"
                                class="comment-count shrink-0"
                                onclick={(e) => e.stopPropagation()}
                                >{formatCommentCountBadge(post.comments_count)}</a
                            >
                        {/if}
                    </span>
                    {#if memoPluginActive && !uiSettingsStore.hideMemoInList}
                        {#if memo?.content}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <span
                                class="memo-badge memo-color--{memo.color || 'yellow'} shrink-0"
                                title={memo.content}
                                onclick={(e: MouseEvent) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                }}
                            >
                                {memo.content.length > 6
                                    ? memo.content.slice(0, 6) + '\u2026'
                                    : memo.content}
                            </span>
                        {/if}
                    {/if}
                </div>

                <!-- 이름 (col 3, 데스크톱만) — legacy: 13px, 100px wide -->
                <span
                    class={isMobileView
                        ? 'hidden'
                        : 'post-meta-text hidden items-center gap-1 truncate md:inline-flex md:w-[120px] md:pl-1'}
                >
                    <Avatar
                        path={post.author_image}
                        updatedAt={post.author_image_updated_at}
                        alt=""
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                    />
                    <AuthorLink
                        authorId={post.author_id}
                        authorName={post.author}
                        isWithdrawn={!!post.is_left}
                    />
                </span>

                <!-- 날짜 (col 4, 데스크톱만) -->
                <span
                    class={isMobileView
                        ? 'hidden'
                        : `post-meta-text hidden md:inline md:w-[70px] md:pl-1 md:text-center ${isToday(post.created_at) ? 'date-today' : ''}`}
                >
                    {formatDateCompact(post.created_at)}
                </span>

                <!-- 조회수 (col 5, 데스크톱만) -->
                <span
                    class={isMobileView
                        ? 'hidden'
                        : 'post-meta-text hidden md:inline md:w-[50px] md:pl-1 md:text-center'}
                >
                    {formatCompactNumber(post.views)}
                </span>

                <!-- 모바일 메타 (Line 2: 추천 · Date · 조회 · Author) -->
                <div class="mobile-meta" class:modern-view={isMobileView}>
                    {#if mobileLikesPill}
                        <span class="mobile-likes-pill inline-flex items-center gap-0.5"
                            ><Heart class="size-3.5" />{post.likes}</span
                        >
                    {:else}
                        <span class="{mobileLikesClass} inline-flex items-center gap-0.5"
                            ><Heart class="size-3.5" />{post.likes}</span
                        >
                    {/if}
                    <span class="mobile-meta-sep {isToday(post.created_at) ? 'date-today' : ''}">
                        {formatDateCompact(post.created_at)}
                    </span>
                    <span class="mobile-meta-sep">{formatCompactNumber(post.views)}</span>
                    <span class="mobile-meta-sep inline-flex items-center gap-0.5">
                        <AuthorLink
                            authorId={post.author_id}
                            authorName={post.author}
                            isWithdrawn={!!post.is_left}
                        />
                    </span>
                </div>
            </div>
        </div>
    </a>
{/if}

<style>
    /* ===== 행 스타일 ===== */
    /* 행 구분선은 wrapper의 divide-y divide-border가 처리 */

    /* 홍보 행 — legacy step-pai: amber bg + left accent */
    .post-promo {
        background: rgba(255, 179, 39, 0.06) !important;
        border-left: 3px solid rgba(255, 179, 39, 0.4) !important;
    }

    /* 공지 행 — subtle foreground tint for both themes */
    .post-notice {
        background: color-mix(in oklch, var(--foreground) 3%, transparent) !important;
        border-left: 3px solid rgba(239, 68, 68, 0.3) !important;
    }

    /* ===== 제목 텍스트 ===== */

    .post-title,
    [class^='post-title-read-'] {
        font-size: var(--list-font-size, 1rem);
        transition: color 0.8s ease-in-out;
    }

    .post-title {
        color: var(--color-foreground);
    }

    /* 읽은 글 스타일 옵션 — font-size 명시 (CSS 특이성 문제 방지) */
    .post-title-read-dimmed {
        font-size: var(--list-font-size, 1rem);
        color: var(--color-muted-foreground);
        opacity: 0.55;
    }

    .post-title-read-bold {
        font-size: var(--list-font-size, 1rem);
        color: var(--color-muted-foreground);
        font-weight: 700;
    }

    .post-title-read-italic {
        font-size: var(--list-font-size, 1rem);
        color: var(--color-muted-foreground);
        font-style: italic;
        font-synthesis: style;
    }

    .post-title-read-underline {
        font-size: var(--list-font-size, 1rem);
        color: var(--color-muted-foreground);
        text-decoration: underline;
    }

    .post-title-read-strikethrough {
        font-size: var(--list-font-size, 1rem);
        color: var(--color-muted-foreground);
        text-decoration: line-through;
    }

    /* ===== 메타데이터 텍스트 (이름, 날짜, 조회) ===== */

    .post-meta-text {
        font-size: 0.9em;
        color: var(--color-muted-foreground);
    }

    /* ===== 댓글 수 ===== */

    .comment-count {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--color-liked, orangered);
    }

    /* ===== 모바일 전용 요소 (scoped → SSR 청크와 동시 로드, 플래시 방지) ===== */

    .mobile-only {
        display: none;
    }

    .mobile-meta {
        display: none;
        font-size: 0.85em;
        color: var(--color-muted-foreground);
    }

    @media (max-width: 767.98px) {
        .mobile-only {
            display: inline-flex !important;
        }

        .mobile-meta {
            display: flex !important;
            align-items: center;
            gap: 0.25rem;
        }
    }

    /* 모던 보기: 데스크탑에서 모바일 레이아웃 강제 적용 */
    .mobile-only.modern-view {
        display: inline-flex !important;
    }

    .mobile-meta.modern-view {
        display: flex !important;
        align-items: center;
        gap: 0.25rem;
    }

    /* 모바일 메타 구분자: CSS-only (HTML에 · 없음 → FOUC 시 점 미노출) */
    .mobile-meta-sep::before {
        content: '·';
        margin-right: 0.25rem;
    }

    .mobile-likes-hot {
        color: var(--color-liked, #f97316);
        font-weight: 600;
    }

    /* 모바일 10+ 추천 */
    .mobile-likes-pill {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--color-liked, #f97316);
    }

    /* 오늘 날짜 — scoped class로 specificity 통일 (Tailwind utility 대신) */
    .date-today {
        color: var(--color-date-today);
    }

    /* ===== 행 높이 (density toggle) ===== */
    .post-row {
        padding-top: calc(0.625em + var(--row-pad-extra, 0.1875em));
        padding-bottom: calc(0.625em + var(--row-pad-extra, 0.1875em));
    }

    @media (min-width: 768px) {
        .post-row {
            padding-top: calc(0.375em + var(--row-pad-extra, 0.1875em));
            padding-bottom: calc(0.375em + var(--row-pad-extra, 0.1875em));
        }
    }

    /* 메모 배지 색상 (인라인 렌더링용) */
    .memo-badge {
        display: inline-block;
        padding: 0 0.375rem;
        border-radius: 0.25rem;
        font-size: 0.6875rem;
        line-height: 1.25rem;
        white-space: nowrap;
    }

    :global(.memo-color--yellow) {
        background-color: #ffe69c;
        color: #664d03;
    }

    :global(.memo-color--green) {
        background-color: #d1e7dd;
        color: #0f5132;
    }

    :global(.memo-color--purple) {
        background-color: #e2d9f3;
        color: #432874;
    }

    :global(.memo-color--red) {
        background-color: #f8d7da;
        color: #dc3545;
    }

    :global(.memo-color--blue) {
        background-color: #cfe2ff;
        color: #084298;
    }
</style>
