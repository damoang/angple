<script lang="ts">
    /**
     * basic 뷰 레이아웃 — 카드형 기본 게시글 본문 레이아웃
     *
     * +page.svelte에서 추출된 게시글 카드 영역.
     * CardHeader (제목, 카테고리, 태그, 작성자, 메타),
     * CardContent (본문, 이미지, 동영상, 링크, 첨부),
     * CardFooter (추천/비추천/신고, 리액션)
     */

    import {
        Card,
        CardHeader,
        CardContent,
        CardFooter,
        CardTitle
    } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Markdown } from '$lib/components/ui/markdown/index.js';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import Download from '@lucide/svelte/icons/download';
    import Paperclip from '@lucide/svelte/icons/paperclip';
    import Video from '@lucide/svelte/icons/video';
    import { deriveVideoPoster } from '$lib/utils/video-poster.js';
    // formatDate 는 prop 으로 주입되지만, 모바일 축약 표기는 이 레이아웃에서만 쓰므로 직접 가져온다.
    import { formatDateTime } from '$lib/utils/format-date.js';
    import Heart from '@lucide/svelte/icons/heart';
    import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
    import Users from '@lucide/svelte/icons/users';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import DealEndReportButton from '$lib/components/features/board/deal-end-report-button.svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { DisciplinedContent } from '$lib/components/ui/discipline-related';
    import { AdultBlur } from '$lib/components/features/adult/index.js';
    import ContentBlur from '$lib/components/features/board/content-blur.svelte';
    import { uiSettingsStore, type ContentFontSize } from '$lib/stores/ui-settings.svelte.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { ReactionBar } from '$lib/components/features/reaction/index.js';
    import { AvatarStack } from '$lib/components/ui/avatar-stack/index.js';
    import Info from '@lucide/svelte/icons/info';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import Pin from '@lucide/svelte/icons/pin';
    import ShareButton from '$lib/components/post/share-button.svelte';
    import ScrapButton from '$lib/components/post/scrap-button.svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import PostRatingWidget from '../../post-rating.svelte';
    import type { ViewLayoutProps } from '../types.js';

    const FONT_SIZES: Record<ContentFontSize, string> = {
        small: '16px',
        base: '18px',
        large: '20px',
        xlarge: '22px',
        '2xlarge': '24px',
        '3xlarge': '28px'
    };

    const currentFontSize = $derived(uiSettingsStore.contentFontSize);

    // 모바일 메타 줄은 폭이 곧 줄 수다. 날짜(111px) + 조회·공감·댓글(175px)이 컬럼 폭을
    // 넘으면 줄바꿈되어 한 줄이 통째로 더 붙는다. 올해 글은 연도를 빼 "08.13 21:58"(78px)로
    // 줄여 한 줄에 담고, 작년 이전 글만 연도를 유지한다(그때도 대개 들어간다).
    const createdShort = $derived.by(() => {
        const full = formatDateTime(post.created_at); // "2026.08.13 21:58"
        const thisYear = new Date()
            .toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
            .slice(0, 4);
        return full.startsWith(`${thisYear}.`) ? full.slice(5) : full;
    });

    import { toast } from 'svelte-sonner';
    import { trackFileDownload } from '$lib/services/ga4.js';
    import PinOff from '@lucide/svelte/icons/pin-off';
    import { attachLightbox } from '$lib/components/ui/image-lightbox/index.js';
    import { onMount } from 'svelte';
    import {
        buildThumbnailSrcSet,
        isTransformableMediaImage,
        toThumbnailUrl
    } from '$lib/utils/thumbnail-url.js';

    let {
        post,
        board,
        boardId,
        isAuthor,
        isAdmin,
        canViewSecret,
        initialScrapped = false,
        likeCount,
        dislikeCount,
        isLiked,
        isDisliked,
        isLiking,
        isDisliking,
        isLikeAnimating,
        likers,
        likersTotal,
        fontSize,
        fontSizeLabel: _fontSizeLabel,
        onLike,
        onDislike,
        onLoadLikers,
        onReport,
        onChangeFontSize,
        memoPluginActive,
        reactionPluginActive,
        MemoBadge,
        beforeContentSlots,
        afterContentSlots,
        editCount = 0,
        formatDate,
        formatTimeShort,
        formatFileSize,
        postContent,
        pageData,
        promotionExpired = false,
        postReactions,
        postReportCount,
        isSanctioned = false,
        truthroomPostId,
        originalPostLink
    }: ViewLayoutProps = $props();

    let hasAffiliateLinks = $derived(postContent?.includes('data-affiliate') ?? false);

    // 이용제한 근거 글: 제목·본문 인스턴스가 이 상태를 공유해 어느 "보기"를 눌러도 함께 공개.
    // 비로그인은 백엔드가 이미 원문을 strip 했고 컴포넌트가 placeholder 만 렌더(소스 유출 0).
    let discReveal = $state(false);

    const isLockedPost = $derived(postReportCount === 'lock' || post.extra_7 === 'lock');

    // 첨부파일 목록: 박스 없는 텍스트 목록 + 기본 접힘(제목 'N개'만). 클릭 시 펼침.
    // 공간 절약이 목적이라 목록 전체를 접는다(구 #13423 앞5개 노출 방식 대체).
    let downloadsOpen = $state(false);

    // 다운로드/링크 클릭 낙관적 증가분(비콘 성공과 무관하게 화면 즉시 반영). key=bf_no / link n.
    let downloadDelta = $state<Record<number, number>>({});
    let linkDelta = $state<Record<number, number>>({});

    function fireBeacon(url: string) {
        try {
            if (navigator.sendBeacon?.(url)) return;
        } catch {
            /* sendBeacon 미지원/실패 → fetch 폴백 */
        }
        fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
    }

    // 다운로드 카운트 비콘: 파일 클릭 시 bf_download += 1 (라이브 집계). GA4 이벤트와 별개.
    function beaconDownload(fileNo: number | undefined | null) {
        if (fileNo == null) return;
        downloadDelta = { ...downloadDelta, [fileNo]: (downloadDelta[fileNo] ?? 0) + 1 };
        fireBeacon(`/api/boards/${boardId}/posts/${post.id}/files/${fileNo}/hit`);
    }

    // 링크 클릭 비콘: wr_link{n}_hit += 1.
    function beaconLink(n: number) {
        linkDelta = { ...linkDelta, [n]: (linkDelta[n] ?? 0) + 1 };
        fireBeacon(`/api/boards/${boardId}/posts/${post.id}/link-hit?n=${n}`);
    }

    // 링크 클릭수 = 과거값(linkHits, g5_write_{board}에서 직접 읽음) + 낙관적 증가분.
    function linkHitFor(n: number): number {
        const base = post.linkHits?.find((l) => l.n === n)?.hit ?? 0;
        return base + (linkDelta[n] ?? 0);
    }

    // 첨부 이미지 라이트박스
    let attachedImagesEl: HTMLDivElement;

    function getAttachmentPreview(url: string): string {
        return isTransformableMediaImage(url) ? toThumbnailUrl(url, '835x626') : url;
    }

    function getAttachmentPreviewSrcSet(url: string): string | undefined {
        const srcset = buildThumbnailSrcSet(url, ['400x225', '835x626']);
        return srcset || undefined;
    }

    onMount(() => {
        if (!attachedImagesEl) return;
        const cleanupLightbox = attachLightbox(attachedImagesEl);
        return () => cleanupLightbox();
    });

    // 공지 토글 (관리자 전용)
    let isNotice = $state(post.is_notice ?? false);
    let togglingNotice = $state(false);

    async function toggleNotice(): Promise<void> {
        if (togglingNotice) return;
        togglingNotice = true;
        try {
            const newType = isNotice ? null : 'normal';
            const res = await fetch(`/api/boards/${boardId}/posts/${post.id}/notice`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notice_type: newType }),
                credentials: 'same-origin'
            });
            if (res.ok) {
                isNotice = !isNotice;
                toast.success(isNotice ? '공지로 고정되었습니다.' : '공지 고정이 해제되었습니다.');
            }
        } catch {
            toast.error('공지 설정에 실패했습니다.');
        } finally {
            togglingNotice = false;
        }
    }
</script>

<!-- 글자 크기 조절 — 종전에는 본문 바로 위에 전용 줄(34px)을 차지했다. 한 번 맞추면
     다시 건드릴 일이 드문 설정인데 매 게시글마다 고정으로 한 줄을 먹어 작성자 줄로 옮겼다.

     라벨은 화면 폭에 맞춰 다르게 쓴다. 닉네임 줄의 실측 여유는 모바일 45px / PC 356px 이다.
       - md 이상: "글자크기" 라벨 + 작게·보통·크게 (170px, 여유 안)
       - 모바일:  작은 "가" / 큰 "가" 두 버튼 (62px). 라벨이나 아이콘을 더 붙이면
                 101~118px 이 되어 여유를 넘긴다.
     모바일이 기호(+/−) 대신 글자 크기 차이로 방향을 나타내는 이유: "+/− 는 뜻이 안 통한다"는
     제보가 있었고, 이 방식은 종전 "가−/가+"(76px)보다 오히려 14px 좁다.

     버튼은 h-[26px] 로 높이를 고정한다. 안쪽 글자 크기가 11px/15px 로 달라도 버튼 높이가
     흔들리지 않아야 작성자 줄(26px)이 커지지 않는다. 26px 은 터치 타겟 최소치이기도 하다.
     bg-muted/40 은 옆의 텍스트 메타(닉네임·IP)와 시각 무게를 구분해 "누를 수 있는 것"임을
     정지 상태에서 알리는 용도다. -->
{#snippet fontSizeControls()}
    <!-- self-center: 부모 줄이 items-baseline 이라 그대로 두면 버튼 박스가 밑선에 매달려
         줄 높이를 밀어낸다. 이 그룹만 세로 중앙으로 되돌린다 (bug/13536). -->
    <span class="ml-auto flex shrink-0 items-center gap-1 self-center">
        <span class="text-muted-foreground hidden text-xs md:inline">글자크기</span>
        <button
            type="button"
            class="text-muted-foreground hover:text-foreground active:bg-muted border-border bg-muted/40 hover:bg-muted inline-flex h-[26px] min-w-[30px] items-center justify-center rounded border px-2 leading-none transition-colors disabled:opacity-30"
            disabled={currentFontSize === 'small'}
            onclick={() => uiSettingsStore.changeContentFontSize(-1)}
            aria-label="글자 작게"
        >
            <span class="text-[11px] md:hidden">가</span>
            <span class="hidden text-xs md:inline">작게</span>
        </button>
        <!-- 기본값 복귀는 md 이상에서만. 모바일은 폭이 없어 작은가/큰가 로 오갈 수 있게만 둔다. -->
        <button
            type="button"
            class="text-muted-foreground hover:text-foreground active:bg-muted border-border bg-muted/40 hover:bg-muted hidden h-[26px] items-center justify-center rounded border px-2 text-xs leading-none transition-colors md:inline-flex"
            onclick={() => uiSettingsStore.changeContentFontSize(0)}
            aria-label="글자 기본">보통</button
        >
        <button
            type="button"
            class="text-muted-foreground hover:text-foreground active:bg-muted border-border bg-muted/40 hover:bg-muted inline-flex h-[26px] min-w-[30px] items-center justify-center rounded border px-2 leading-none transition-colors disabled:opacity-30"
            disabled={currentFontSize === '3xlarge'}
            onclick={() => uiSettingsStore.changeContentFontSize(1)}
            aria-label="글자 크게"
        >
            <span class="text-[15px] md:hidden">가</span>
            <span class="hidden text-xs md:inline">크게</span>
        </button>
    </span>
{/snippet}

<!-- 조회/공감/댓글 — 모바일에서는 작성자 날짜 옆으로, md 이상은 메타 줄 우측으로
     같은 마크업을 두 위치에 렌더한다(둘 중 하나만 보이므로 중복 노출은 없다). -->
{#snippet metaCounts()}
    <!-- text-xs: 메타 보조 정보는 14px 한 값으로 통일한다(bug/13536). 종전 0.85em 은
         부모 폰트에 따라 값이 흔들리고, 옆의 날짜(0.9em)와 크기가 달라 같은 줄에서
         기준선이 어긋났다. items-baseline 과 함께 써야 효과가 있다. -->
    <div class="text-secondary-foreground flex items-baseline gap-2 text-sm sm:gap-4">
        <span>조회 {post.views.toLocaleString()}</span>
        <span>공감 {likeCount.toLocaleString()}</span>
        <!-- bug/13376: 옆의 조회·공감과 똑같이 생겨서 누를 수 있는 줄 몰랐다는
             제보. hover 만으로는 터치 기기에서 아무 단서가 되지 못한다.
             테두리와 아래 화살표로 "눌러서 아래로 간다"를 정지 상태에서 보인다.
             bug/13536: 종전 -my-0.5 가 배지를 줄 밖으로 4px 밀어내 "붕 떠 보인다"는
             제보로 이어졌다. 음수 마진을 없애고 줄 안에 들어오게 한다. -->
        <button
            type="button"
            class="border-border hover:bg-muted hover:text-foreground inline-flex cursor-pointer items-center gap-0.5 rounded-full border px-2 py-0 leading-5 transition-colors"
            aria-label="댓글 {post.comments_count}개로 이동"
            onclick={() =>
                document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}
        >
            댓글 {post.comments_count.toLocaleString()}
            <ChevronDown class="h-3 w-3" aria-hidden="true" />
        </button>
    </div>
{/snippet}

<!-- 게시글 카드 -->
<Card class="bg-background mb-6 gap-3 rounded-xl px-3 pb-5 pt-3 md:px-3">
    <!-- gap-3: CardHeader 는 자체적으로 grid gap-1.5 를 갖는다. 종전 space-y-3 는
         그 gap 을 대체하지 못하고 margin 으로 얹혀 6+12=18px 이 됐다(의도는 12px).
         같은 축의 gap 으로 주면 tailwind-merge 가 gap-1.5 를 대체해 정확히 12px. -->
    <CardHeader class="gap-3">
        <div>
            {#if post.category}
                <div class="mb-2 flex flex-wrap gap-1.5">
                    <span
                        class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                    >
                        {post.category}
                    </span>
                </div>
            {/if}
            <!-- 글 제목이 이 페이지의 주제목이다. 종전엔 CardTitle 이 div 라
                 상세 페이지에 h1 이 하나도 없었다(SEO·스크린리더 내비게이션 저해). -->
            <CardTitle
                tag="h1"
                class="text-foreground flex flex-wrap items-center gap-2 break-words text-xl font-bold sm:text-2xl"
            >
                {#if isAdmin}
                    <button
                        type="button"
                        onclick={toggleNotice}
                        disabled={togglingNotice}
                        class="shrink-0 transition-colors {isNotice
                            ? 'text-primary hover:text-destructive'
                            : 'text-muted-foreground/40 hover:text-primary'}"
                        title={isNotice ? '공지 해제' : '공지 고정'}
                    >
                        {#if isNotice}
                            <Pin class="h-5 w-5" />
                        {:else}
                            <PinOff class="h-5 w-5" />
                        {/if}
                    </button>
                {/if}
                {#if post.is_secret}
                    <Lock class="text-muted-foreground h-6 w-6 shrink-0" />
                {/if}
                <!-- bug/13388: 맨몸 텍스트는 익명 flex item 이 되어 min-width/줄바꿈을
                     제어할 수 없고, iOS WebKit 에서 줄바꿈 폭 오계산 → 1행 넘침이
                     조상 overflow-x:hidden 에 잘려 글자가 소실된다. 실요소로 감싼다. -->
                <span class="min-w-0 [overflow-wrap:anywhere]">
                    {#if post.is_discipline_related}
                        <DisciplinedContent
                            inline
                            isLoggedIn={authStore.isAuthenticated}
                            bind:revealed={discReveal}
                        >
                            {post.title}
                        </DisciplinedContent>
                    {:else}
                        {post.title}
                    {/if}
                </span>
                {#if isLockedPost}
                    <span
                        class="bg-destructive/10 text-destructive inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                    >
                        <Lock class="h-3 w-3" />
                        신고잠금
                    </span>
                {/if}
            </CardTitle>
            {#if post.tags && post.tags.length > 0}
                <div class="mt-3 flex flex-wrap gap-2">
                    {#each post.tags as tag, i (i)}
                        <a href="/tags/{encodeURIComponent(tag)}">
                            <Badge variant="secondary" class="hover:bg-primary/10 cursor-pointer"
                                >#{tag}</Badge
                            >
                        </a>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- 작성자/메타 — 모바일(390px)에서 작성자 블록(239px)과 조회·공감·댓글(175px)이
             한 줄에 안 들어가 줄바꿈되고, 그때 gap-4 의 행간 16px 까지 붙어 106px 이 됐다.
             상단 chrome 전체에서 가장 큰 단일 항목이었다(#상단여백).
             모바일은 카운트를 날짜 옆으로 접고 아바타를 size-7 로 줄여 2줄에 고정한다.
             md 이상은 한 줄에 들어가므로 종전 레이아웃(우측 정렬) 그대로. -->
        <div
            class="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 md:gap-4 md:pt-4"
        >
            {#if post.deleted_at}
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    <div
                        class="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full md:size-10"
                    >
                        ?
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-muted-foreground flex items-center font-medium">
                            작성자 정보 비공개
                            {@render fontSizeControls()}
                        </p>
                        <div class="mt-0.5 md:hidden">{@render metaCounts()}</div>
                    </div>
                </div>
            {:else}
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    {#if getAvatarUrl(post.author_image, post.author_image_updated_at)}
                        <img
                            src={getAvatarUrl(post.author_image, post.author_image_updated_at)}
                            alt={post.author}
                            loading="lazy"
                            decoding="async"
                            class="size-7 shrink-0 rounded-full object-cover md:size-10"
                            onerror={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                        <div
                            class="bg-primary text-primary-foreground hidden size-7 shrink-0 items-center justify-center rounded-full md:size-10"
                        >
                            {post.author.charAt(0).toUpperCase()}
                        </div>
                    {:else}
                        <div
                            class="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full md:size-10"
                        >
                            {post.author.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <!-- 닉네임(16px)·IP(12px)가 한 줄에 서므로 밑선 정렬한다.
                             종전 items-center 조합에서 기준선이 3px 어긋났다 (bug/13536).
                             닉네임 크기는 줄이지 않는다 — 이 줄의 주 정보이고, 줄이면 메타 블록이
                             2px 더 좁아져 "답답하다"는 같은 제보의 다른 지적과 충돌한다. -->
                        <p class="text-foreground flex items-baseline gap-1.5 font-medium">
                            <LevelBadge level={memberLevelStore.getLevel(post.author_id)} />
                            <AuthorLink
                                authorId={post.author_id}
                                authorName={post.author}
                                isWithdrawn={!!post.is_left}
                            />
                            {#if authStore.isAuthenticated && memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
                                <MemoBadge
                                    memberId={post.author_id}
                                    showIcon={true}
                                    blur={uiSettingsStore.blurMemo}
                                />
                            {/if}
                            {#if post.author_ip}
                                <span class="text-muted-foreground ml-1 text-xs font-normal"
                                    >({post.author_ip})</span
                                >
                            {/if}
                            {@render fontSizeControls()}
                        </p>
                        <!-- items-baseline: 크기가 다른 요소를 items-center 로 묶으면 글자 밑선이
                             어긋난다. 한글 폰트는 ascent/descent 비율이 OS 마다 달라(iOS Apple SD
                             Gothic Neo vs Android Noto Sans KR) 어긋나는 정도도 기기별로 달라진다.
                             밑선 정렬은 폰트 metrics 에 영향받지 않는다 (bug/13536). -->
                        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p class="text-secondary-foreground text-sm">
                                <!-- 모바일은 폭 절약형(올해 글이면 연도 생략),
                                     md 이상은 종전의 읽기 좋은 상대형 표기를 유지한다. -->
                                <span class="md:hidden">{createdShort}</span>
                                <span class="hidden md:inline">{formatDate(post.created_at)}</span>
                                <!-- 수정 배지: 리비전 기반 edit_count/last_edited_at (백엔드 주입) 사용.
                                 게시글 수정 시 wr_last 미갱신이라 post.updated_at 대신 이 값을 쓴다.
                                 ⛔ 5분 grace 숨김은 2026-08-05 제거했다. 실측상 그 게이트가
                                    글 수정의 67.3%, 댓글 수정의 88.2%를 화면에서 지웠다.
                                    특히 신고 직후 5분 안에 문제 표현을 순화하면 기록만 남고
                                    화면엔 흔적이 없어 판정 근거가 사라졌다. 수정은 수정이다. -->
                                {#if post.edit_count && post.edit_count > 0 && post.last_edited_at && formatTimeShort}
                                    <span class="text-muted-foreground/70"
                                        >· 수정 {post.edit_count}회({formatTimeShort(
                                            post.last_edited_at,
                                            post.created_at
                                        )})</span
                                    >
                                {/if}
                                {#if post.deleted_at && formatTimeShort}
                                    <span class="text-red-500/70"
                                        >· 삭제됨 {formatTimeShort(
                                            post.deleted_at,
                                            post.created_at
                                        )}</span
                                    >
                                {/if}
                            </p>
                            <div class="md:hidden">{@render metaCounts()}</div>
                        </div>
                    </div>
                </div>
            {/if}

            <div class="ml-auto hidden md:flex">{@render metaCounts()}</div>
        </div>

        <!-- 별점 위젯 (앙티티 Phase 0): features.rating 보드에서만 백엔드가
             post.rating 을 동봉 → 없으면 렌더 0 (전 게시판 회귀 0) -->
        {#if post.rating}
            <PostRatingWidget
                {boardId}
                postId={post.id}
                initial={post.rating}
                aspects={pageData?.postAspects}
                archive={post.archiveRating}
            />
        {/if}
    </CardHeader>
    <CardContent class="space-y-6">
        <!-- 진실의방: 원본 게시글/댓글 링크 -->
        {#if originalPostLink}
            <div
                class="bg-muted/50 border-primary/20 flex items-center gap-2 rounded-lg border p-3 text-sm"
            >
                <span class="text-muted-foreground">
                    {originalPostLink.commentId ? '원본 댓글:' : '원본 게시글:'}
                </span>
                <a
                    href="/{originalPostLink.boardId}/{originalPostLink.postId}{originalPostLink.commentId
                        ? `#c_${originalPostLink.commentId}`
                        : ''}"
                    class="text-primary hover:underline"
                >
                    /{originalPostLink.boardId}/{originalPostLink.postId}{originalPostLink.commentId
                        ? ` (댓글 #${originalPostLink.commentId})`
                        : ''}
                </a>
            </div>
        {/if}

        <!-- 플러그인 슬롯: post.before_content (Q&A 상태 헤더 등) -->
        {#each beforeContentSlots as slot (slot.component)}
            {@const SlotComponent = slot.component}
            <SlotComponent
                {...slot.propsMapper ? slot.propsMapper(pageData) : { data: pageData }}
            />
        {/each}

        <!-- 알뜰구매 모든 링크열기 (GAM 바로 아래) -->
        {#each afterContentSlots as slot (slot.component)}
            {@const SlotComponent = slot.component}
            <SlotComponent
                {...slot.propsMapper ? slot.propsMapper(pageData) : { data: pageData }}
            />
        {/each}

        <!-- 글자 크기 조절 줄은 여기 있었다 → 작성자 줄로 이동(fontSizeControls snippet).
             본문 바로 위 34px 을 매 게시글마다 고정으로 쓰던 자리다. -->

        <!-- 게시글 본문 -->
        {#if canViewSecret}
            <AdultBlur isAdult={post.is_adult ?? false}>
                <ContentBlur
                    shouldBlur={uiSettingsStore.shouldBlurContent(post.title) || isLockedPost}
                    blurReason={isLockedPost
                        ? '신고 누적으로 가려진 글입니다 — 클릭하면 본인 책임 하에 표시'
                        : undefined}
                >
                    <div id="economy-post-content" style="font-size: {FONT_SIZES[currentFontSize]}">
                        {#if post.is_discipline_related}
                            <DisciplinedContent
                                isLoggedIn={authStore.isAuthenticated}
                                bind:revealed={discReveal}
                            >
                                <Markdown content={postContent} />
                            </DisciplinedContent>
                        {:else}
                            <Markdown content={postContent} />
                        {/if}
                    </div>

                    {#if hasAffiliateLinks}
                        <p
                            class="text-muted-foreground mt-4 flex items-start gap-1.5 text-xs leading-relaxed"
                        >
                            <Info class="mt-0.5 h-3 w-3 shrink-0" />
                            <span
                                >이 글에 포함된 일부 링크는 제휴 링크이며, 다모앙은 소정의 커미션을
                                제공 받을 수 있습니다.</span
                            >
                        </p>
                    {/if}

                    {#if boardId === 'economy'}
                        <DealEndReportButton {boardId} postId={post.id} category={post.category} />
                    {/if}

                    {#if post.videos && post.videos.length > 0}
                        <div class="mt-6 space-y-4">
                            {#each post.videos as video, i (i)}
                                <div class="overflow-hidden rounded-lg border">
                                    <!-- poster = 관례 키(…_poster.jpg) 도출. 포스터 없는 옛 동영상은
                                         404 인데 <video poster> 는 로드 실패를 조용히 무시하므로 무해 -->
                                    <video
                                        controls
                                        preload="none"
                                        playsinline
                                        poster={deriveVideoPoster(video.url)}
                                        class="w-full"
                                    >
                                        <source src={video.url} />
                                        동영상을 재생할 수 없습니다.
                                    </video>
                                    <div
                                        class="bg-muted/50 flex items-center gap-3 border-t px-4 py-2.5"
                                    >
                                        <Video class="text-muted-foreground h-4 w-4 shrink-0" />
                                        <span class="text-foreground min-w-0 truncate text-sm">
                                            {video.filename}
                                        </span>
                                        {#if video.size}
                                            <span class="text-muted-foreground shrink-0 text-xs">
                                                {formatFileSize(video.size)}
                                            </span>
                                        {/if}
                                        <a
                                            href={video.url}
                                            download={video.filename}
                                            onclick={() =>
                                                trackFileDownload(boardId, video.filename, 'video')}
                                            class="text-primary hover:text-primary/80 ml-auto flex shrink-0 items-center gap-1 text-sm font-medium"
                                        >
                                            <Download class="h-4 w-4" />
                                            다운로드
                                        </a>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    {#if post.images && post.images.length > 0}
                        <div bind:this={attachedImagesEl} class="mt-6 grid gap-4">
                            {#each post.images as image, i (i)}
                                <img
                                    src={getAttachmentPreview(image)}
                                    srcset={getAttachmentPreviewSrcSet(image)}
                                    sizes="(max-width: 768px) 100vw, 835px"
                                    data-original={image}
                                    alt="게시글 이미지"
                                    class="max-w-full rounded-lg border"
                                    loading="lazy"
                                    decoding="async"
                                    onerror={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const original = target.getAttribute('data-original');
                                        if (original && target.src !== original) {
                                            target.src = original;
                                            return;
                                        }
                                        target.style.display = 'none';
                                    }}
                                />
                            {/each}
                        </div>
                    {/if}

                    {#if post.downloads && post.downloads.length > 0}
                        <div class="mt-6">
                            <!-- 박스 없는 텍스트 목록 + 기본 접힘: 헤더 클릭 시 펼침 -->
                            <button
                                type="button"
                                onclick={() => (downloadsOpen = !downloadsOpen)}
                                aria-expanded={downloadsOpen}
                                class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors"
                            >
                                <Paperclip class="h-4 w-4" />
                                첨부파일 {post.downloads.length}개
                                <ChevronDown
                                    class="h-4 w-4 transition-transform {downloadsOpen
                                        ? 'rotate-180'
                                        : ''}"
                                />
                            </button>
                            {#if downloadsOpen}
                                <ul class="mt-2 space-y-1.5">
                                    {#each post.downloads as file, i (file.no ?? i)}
                                        <li class="flex items-center gap-2 text-sm">
                                            <a
                                                href={file.url}
                                                download={file.filename}
                                                onclick={() => {
                                                    trackFileDownload(boardId, file.filename);
                                                    beaconDownload(file.no);
                                                }}
                                                class="text-foreground hover:text-primary flex min-w-0 flex-1 items-center gap-1.5 hover:underline"
                                            >
                                                <Download
                                                    class="text-muted-foreground h-3.5 w-3.5 shrink-0"
                                                />
                                                <span class="truncate">{file.filename}</span>
                                            </a>
                                            {#if file.size}
                                                <span
                                                    class="text-muted-foreground shrink-0 text-xs"
                                                >
                                                    {formatFileSize(file.size)}
                                                </span>
                                            {/if}
                                            <span
                                                class="text-muted-foreground shrink-0 whitespace-nowrap text-xs"
                                            >
                                                다운 {(file.download_count ?? 0) +
                                                    (downloadDelta[file.no ?? -1] ?? 0)}
                                            </span>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                    {/if}
                </ContentBlur>
            </AdultBlur>

            {#if post.link1 || post.link2}
                <div class="mt-4 space-y-1.5">
                    {#if post.link1}
                        <div class="flex items-center gap-1.5 text-sm">
                            <ExternalLink class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <a
                                href={post.link1}
                                target="_blank"
                                rel={post.link1_affiliate
                                    ? 'nofollow noopener sponsored'
                                    : 'noopener noreferrer'}
                                onclick={() => beaconLink(1)}
                                class="text-primary min-w-0 flex-1 truncate hover:underline"
                                >{post.link1_display || post.link1}</a
                            >
                            <span class="text-muted-foreground shrink-0 whitespace-nowrap text-xs">
                                클릭 {linkHitFor(1)}
                            </span>
                        </div>
                    {/if}
                    {#if post.link2}
                        <div class="flex items-center gap-1.5 text-sm">
                            <ExternalLink class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <a
                                href={post.link2}
                                target="_blank"
                                rel={post.link2_affiliate
                                    ? 'nofollow noopener sponsored'
                                    : 'noopener noreferrer'}
                                onclick={() => beaconLink(2)}
                                class="text-primary min-w-0 flex-1 truncate hover:underline"
                                >{post.link2_display || post.link2}</a
                            >
                            <span class="text-muted-foreground shrink-0 whitespace-nowrap text-xs">
                                클릭 {linkHitFor(2)}
                            </span>
                        </div>
                    {/if}
                </div>
            {/if}
        {:else}
            <div
                class="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
            >
                <Lock class="text-muted-foreground mb-4 h-12 w-12" />
                {#if promotionExpired}
                    <p class="text-muted-foreground text-lg font-medium">
                        광고 기간이 종료된 게시글입니다
                    </p>
                    <p class="text-muted-foreground mt-1 text-sm">
                        광고주와 관리자만 볼 수 있습니다.
                    </p>
                {:else}
                    <p class="text-muted-foreground text-lg font-medium">비밀글입니다</p>
                    <p class="text-muted-foreground mt-1 text-sm">
                        작성자와 관리자만 볼 수 있습니다.
                    </p>
                {/if}
            </div>
        {/if}
    </CardContent>
    {#if canViewSecret}
        <CardFooter class="flex-col items-start gap-3">
            <!-- 추천/비추천/신고 버튼 -->
            <div
                id="likes"
                class="flex w-full flex-wrap items-center gap-3"
                style="scroll-margin-top: 100px"
            >
                {#if boardId !== 'claim'}
                    <!-- 추천 버튼 -->
                    <div
                        class="flex items-center rounded-lg border {isLiked
                            ? 'border-liked/40 bg-liked/5'
                            : 'border-border'}"
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={onLike}
                            disabled={isLiking}
                            class="gap-2 {isLiked ? 'text-liked' : ''}"
                        >
                            <Heart
                                class="h-5 w-5 {isLiked ? 'fill-liked' : ''} {isLikeAnimating
                                    ? 'like-animation'
                                    : ''}"
                            />
                            <span class="font-semibold">{likeCount}</span>
                        </Button>
                        {#if authStore.isAuthenticated}
                            <button
                                type="button"
                                onclick={onLoadLikers}
                                class="border-l px-2 py-1 text-xs transition-colors {isLiked
                                    ? 'border-liked/40 text-liked'
                                    : 'text-muted-foreground hover:text-foreground border-border'}"
                            >
                                <Users class="h-4 w-4" />
                            </button>
                        {/if}
                    </div>

                    <!-- 추천자 아바타 스택 (같은 줄) -->
                    {#if authStore.isAuthenticated && likers.length > 0}
                        <AvatarStack
                            items={likers}
                            total={likersTotal}
                            max={5}
                            size="sm"
                            onclick={onLoadLikers}
                        />
                    {/if}

                    <!-- 비추천 버튼 (게시판 설정에서 활성화된 경우만) -->
                    {#if board?.use_nogood}
                        <div class="border-border flex items-center rounded-lg border">
                            <Button
                                variant="ghost"
                                size="sm"
                                onclick={onDislike}
                                disabled={isDisliking}
                                class="gap-2 {isDisliked ? 'text-disliked' : ''}"
                            >
                                <ThumbsDown class="h-5 w-5 {isDisliked ? 'fill-disliked' : ''}" />
                                <span class="font-semibold">{dislikeCount}</span>
                            </Button>
                        </div>
                    {/if}
                {/if}

                <!-- 스크랩 + 공유 + 신고 (우측 정렬).
                     bug/13447: 예전엔 상단 툴바(#238)와 하단(#11666) 두 곳에 스크랩이 있었고
                     하단본이 initialScrapped 를 안 받아 표시가 부정확했다. bug/13468: 하단본을
                     통째로 제거했더니 사용자가 글 읽고 누르던 위치의 스크랩이 사라졌다는 제보.
                     → 하단본을 initialScrapped 와 함께 복원(정확 표시 + 익숙한 위치 둘 다 충족). -->
                <div class="ml-auto flex items-center gap-1">
                    {#if board?.use_sns}
                        <ShareButton {boardId} postId={post.id} title={post.title || ''} />
                    {/if}
                    {#if !isAuthor && !isSanctioned}
                        <!-- #12420: 신고잠금 글의 추가 신고 게이트.
                             제재 확정(B형)만 숨긴다 — 재신고 시 백엔드 409+트리거로 차단되기 때문.
                             신고 누적 자동잠금(A형)은 다시 열어 추가 신고를 허용한다(백엔드가 계속 accept).
                             ⛔ isLockedPost(가림/배지/워터마크)는 그대로 유지 — 게이트만 isSanctioned 로 분리. -->
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={() => {
                                if (!authStore.isAuthenticated) {
                                    authStore.redirectToLogin();
                                    return;
                                }
                                onReport();
                            }}
                            class="text-muted-foreground hover:text-destructive gap-2"
                        >
                            <Flag class="h-4 w-4" />
                            <span>신고</span>
                        </Button>
                    {/if}
                    <!-- 스크랩은 신고 오른쪽 끝에. 종전엔 이 줄 맨 왼쪽에 아이콘만 있어서
                         옆의 공유·신고가 아이콘+문구인데 혼자 문구가 없었고, 북마크 아이콘만으로는
                         무슨 버튼인지 알기 어려웠다. size="sm" 이면 컴포넌트가 "스크랩"/"스크랩됨"
                         문구를 함께 렌더한다(상단 툴바본은 아이콘만 유지). -->
                    {#if authStore.isAuthenticated}
                        <ScrapButton {boardId} postId={post.id} {initialScrapped} size="sm" />
                    {/if}
                    <PluginSlot
                        name="post-detail-actions"
                        {boardId}
                        postId={post.id}
                        postAuthorId={post.author_id}
                    />
                </div>
            </div>

            <!-- 리액션 (da-reaction 플러그인, 소명게시판 제외) -->
            {#if reactionPluginActive && boardId !== 'claim'}
                <ReactionBar
                    {boardId}
                    postId={post.id}
                    target="post"
                    initialReactions={postReactions}
                />
            {/if}
        </CardFooter>
    {/if}
</Card>

<style>
    /* 좋아요 버튼 애니메이션 (ASIS 다모앙과 동일) */
    @keyframes da-thumbs-up {
        0% {
            transform: scale(1) translateX(0) rotate(0deg) translateY(0);
        }
        40% {
            transform: scale(1.2) translateX(-1px) rotate(-19deg) translateY(-4px);
        }
        85% {
            transform: scale(1) translateX(0) rotate(3deg) translateY(1px);
        }
        100% {
            transform: scale(1) translateX(0) rotate(0deg) translateY(0);
        }
    }

    :global(.like-animation) {
        animation: da-thumbs-up 1s ease-in-out;
    }
</style>
