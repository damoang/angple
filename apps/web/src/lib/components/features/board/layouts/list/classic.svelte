<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import type { Component } from 'svelte';
    import Lock from '@lucide/svelte/icons/lock';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Play from '@lucide/svelte/icons/play';
    import Pin from '@lucide/svelte/icons/pin';
    import { getMemberIconUrl, handleIconError } from '$lib/utils/member-icon.js';
    import { formatDate, isToday } from '$lib/utils/format-date.js';
    import { formatCompactNumber } from '$lib/utils/format-number.js';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';

    // 메모 플러그인
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let MemoBadge = $state<Component | null>(null);

    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
        }
    });

    // Props
    let {
        post,
        displaySettings,
        href,
        isRead = false
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
    } = $props();

    // 회원 아이콘 URL
    const iconUrl = $derived(getMemberIconUrl(post.author_id));

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

    // 동영상 여부 (extra_9에 유튜브 URL)
    const hasVideo = $derived(!!post.extra_9);

    // 이미지 첨부 여부
    const hasImage = $derived(
        post.has_file || (post.images && post.images.length > 0) || !!post.extra_10
    );

    // 홍보 게시글 여부
    const isPromo = $derived(post.category === '홍보');

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
</script>

<!-- Classic 스킨: 데스크톱 CSS Grid 5컬럼 (추천|제목|이름|날짜|조회) -->
{#if isDeleted}
    <div class="bg-background px-4 py-1.5 opacity-50">
        <div class="flex items-center gap-2 md:gap-3">
            <div class="hidden shrink-0 md:block">
                <div
                    class="flex h-5 w-10 items-center justify-center rounded-lg text-xs font-semibold leading-5"
                    style="background: color-mix(in oklch, var(--foreground) 4%, transparent); color: color-mix(in oklch, var(--foreground) 20%, transparent);"
                >
                    -
                </div>
            </div>
            <div class="min-w-0 flex-1">
                <span class="text-muted-foreground text-[15px]">[삭제된 게시물입니다]</span>
            </div>
        </div>
    </div>
{:else}
    <a
        {href}
        class="post-row bg-background hover:bg-accent block px-4 no-underline transition-colors"
        class:post-promo={isPromo}
        class:post-notice={post.is_notice}
        data-sveltekit-preload-data="hover"
    >
        <div
            class="flex items-center gap-2 md:grid md:grid-cols-[60px_1fr_auto_auto_auto] md:items-center md:gap-0"
        >
            <!-- 추천 박스 (col 1, 데스크톱만) — legacy: rcmd-box 40×20 rounded-lg -->
            <div class="hidden md:flex md:items-center md:justify-center">
                {#if post.is_notice}
                    <div
                        class="flex h-5 w-10 items-center justify-center rounded-lg"
                        style="background: rgba(239,68,68,0.1);"
                    >
                        <Pin class="h-3.5 w-3.5" style="color: rgb(239,68,68);" />
                    </div>
                {:else}
                    <div
                        class="flex h-5 w-10 items-center justify-center rounded-lg text-xs font-semibold leading-5"
                        style={likesStepStyle}
                    >
                        {post.likes.toLocaleString()}
                    </div>
                {/if}
            </div>

            <!-- 콘텐츠 (모바일: block, 데스크톱: contents → 그리드 col 2~5 참여) -->
            <div class="min-w-0 flex-1 space-y-1 md:contents md:space-y-0">
                <!-- 제목 줄 (col 2) -->
                <div class="flex min-w-0 items-center gap-1">
                    {#if post.is_notice}
                        <span class="mobile-only" style="display:none"
                            ><Pin class="text-liked h-3.5 w-3.5 shrink-0" /></span
                        >
                    {/if}
                    {#if post.is_adult}
                        <Badge variant="destructive" class="shrink-0 px-1 py-0 text-[10px]"
                            >19</Badge
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
                    <span class="truncate {isRead ? 'post-title-read' : 'post-title'}">
                        {post.title}
                    </span>
                    <!-- 부가 아이콘: N, 이미지, 동영상, 댓글 -->
                    {#if isNew}
                        <span class="text-liked shrink-0 text-[10px] font-bold">N</span>
                    {/if}
                    {#if hasVideo}
                        <Play class="text-destructive h-3.5 w-3.5 shrink-0" />
                    {:else if hasImage}
                        <ImageIcon class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    {/if}
                    {#if post.comments_count > 0}
                        <span class="comment-count shrink-0">+{post.comments_count}</span>
                    {/if}
                </div>

                <!-- 이름 (col 3, 데스크톱만) — legacy: 13px, 100px wide -->
                <span
                    class="post-meta-text hidden items-center gap-1 truncate md:inline-flex md:w-[120px] md:pl-1"
                >
                    {#if iconUrl}
                        <img
                            src={iconUrl}
                            alt=""
                            class="h-5 w-5 shrink-0 rounded-full object-cover"
                            onerror={handleIconError}
                        />
                    {/if}
                    {post.author}
                    {#if memoPluginActive && MemoBadge}
                        <MemoBadge memberId={post.author_id} />
                    {/if}
                </span>

                <!-- 날짜 (col 4, 데스크톱만) -->
                <span
                    class="post-meta-text hidden md:inline md:w-[70px] md:pl-1 md:text-center {isToday(
                        post.created_at
                    )
                        ? 'date-today'
                        : ''}"
                >
                    {formatDate(post.created_at)}
                </span>

                <!-- 조회수 (col 5, 데스크톱만) -->
                <span class="post-meta-text hidden md:inline md:w-[50px] md:pl-1 md:text-center">
                    {formatCompactNumber(post.views)}
                </span>

                <!-- 모바일 메타 (Line 2: 👍likes · Author · Date · 조회) -->
                <div class="mobile-meta" style="display:none">
                    {#if mobileLikesPill}
                        <span class="mobile-likes-pill">👍{post.likes}</span>
                    {:else}
                        <span class={mobileLikesClass}>👍{post.likes}</span>
                    {/if}
                    <span class="mobile-meta-sep inline-flex items-center gap-0.5">
                        {#if iconUrl}
                            <img
                                src={iconUrl}
                                alt=""
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                                onerror={handleIconError}
                            />
                        {/if}
                        {post.author}
                        {#if memoPluginActive && MemoBadge}
                            <MemoBadge memberId={post.author_id} />
                        {/if}
                    </span>
                    <span class="mobile-meta-sep {isToday(post.created_at) ? 'date-today' : ''}">
                        {formatDate(post.created_at)}
                    </span>
                    <span class="mobile-meta-sep">{formatCompactNumber(post.views)}</span>
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
    .post-title-read {
        font-size: 1rem;
        font-weight: 600;
        transition: color 0.8s ease-in-out;
    }

    .post-title {
        color: var(--color-foreground);
    }

    /* 읽은 글 — weight 동일(레이아웃 시프트 방지), 색상+투명도로 확실히 구분 */
    .post-title-read {
        color: var(--color-muted-foreground);
        opacity: 0.55;
    }

    /* ===== 메타데이터 텍스트 (이름, 날짜, 조회) ===== */

    .post-meta-text {
        font-size: 15px;
        color: var(--color-muted-foreground);
    }

    /* ===== 댓글 수 ===== */

    .comment-count {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-liked, orangered);
    }

    /* ===== 모바일 전용 요소 (scoped → SSR 청크와 동시 로드, 플래시 방지) ===== */

    .mobile-only {
        display: none;
    }

    .mobile-meta {
        display: none;
        font-size: 13px;
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

    /* 모바일 메타 구분자: CSS-only (HTML에 · 없음 → FOUC 시 점 미노출) */
    .mobile-meta-sep::before {
        content: '·';
        margin-right: 0.25rem;
    }

    .mobile-likes-hot {
        color: var(--color-liked, #f97316);
        font-weight: 600;
    }

    /* 모바일 10+ 추천 pill 배지 */
    .mobile-likes-pill {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 8px;
        background: rgba(59, 130, 246, 0.25);
        color: var(--color-foreground);
    }

    /* 오늘 날짜 — scoped class로 specificity 통일 (Tailwind utility 대신) */
    .date-today {
        color: var(--color-date-today);
    }

    /* ===== 행 높이 (density toggle) ===== */
    .post-row {
        padding-top: calc(10px + var(--row-pad-extra, 3px));
        padding-bottom: calc(10px + var(--row-pad-extra, 3px));
    }

    @media (min-width: 768px) {
        .post-row {
            padding-top: calc(6px + var(--row-pad-extra, 3px));
            padding-bottom: calc(6px + var(--row-pad-extra, 3px));
        }
    }
</style>
