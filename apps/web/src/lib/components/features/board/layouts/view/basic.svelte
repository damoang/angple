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
    import Heart from '@lucide/svelte/icons/heart';
    import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
    import Users from '@lucide/svelte/icons/users';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import ScrapButton from '$lib/components/post/scrap-button.svelte';
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
    import Pin from '@lucide/svelte/icons/pin';
    import ShareButton from '$lib/components/post/share-button.svelte';
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
        truthroomPostId,
        originalPostLink
    }: ViewLayoutProps = $props();

    let hasAffiliateLinks = $derived(postContent?.includes('data-affiliate') ?? false);

    // 이용제한 근거 글: 제목·본문 인스턴스가 이 상태를 공유해 어느 "보기"를 눌러도 함께 공개.
    // 비로그인은 백엔드가 이미 원문을 strip 했고 컴포넌트가 placeholder 만 렌더(소스 유출 0).
    let discReveal = $state(false);

    const isLockedPost = $derived(postReportCount === 'lock' || post.extra_7 === 'lock');

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

<!-- 게시글 카드 -->
<Card class="bg-background mb-6 rounded-xl px-3 pb-5 pt-4 md:px-3">
    <CardHeader class="space-y-3">
        <div>
            {#if post.category}
                <div class="mb-3 flex flex-wrap gap-1.5">
                    <span
                        class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                    >
                        {post.category}
                    </span>
                </div>
            {/if}
            <CardTitle
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

        <div class="border-border flex flex-wrap items-center gap-4 border-t pt-4">
            {#if post.deleted_at}
                <div class="flex items-center gap-2">
                    <div
                        class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full"
                    >
                        ?
                    </div>
                    <div>
                        <p class="text-muted-foreground font-medium">작성자 정보 비공개</p>
                    </div>
                </div>
            {:else}
                <div class="flex items-center gap-2">
                    {#if getAvatarUrl(post.author_image, post.author_image_updated_at)}
                        <img
                            src={getAvatarUrl(post.author_image, post.author_image_updated_at)}
                            alt={post.author}
                            loading="lazy"
                            decoding="async"
                            class="size-10 rounded-full object-cover"
                            onerror={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                        <div
                            class="bg-primary text-primary-foreground hidden size-10 items-center justify-center rounded-full"
                        >
                            {post.author.charAt(0).toUpperCase()}
                        </div>
                    {:else}
                        <div
                            class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full"
                        >
                            {post.author.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div>
                        <p class="text-foreground flex items-center gap-1.5 font-medium">
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
                        </p>
                        <p class="text-secondary-foreground" style="font-size: 0.9em;">
                            {formatDate(post.created_at)}
                            <!-- 수정 배지: 리비전 기반 edit_count/last_edited_at (백엔드 주입) 사용.
                                 게시글 수정 시 wr_last 미갱신이라 post.updated_at 대신 이 값을 쓴다.
                                 5분 grace: 작성 직후(<5분) 수정은 숨김(댓글과 일관). -->
                            {#if post.edit_count && post.edit_count > 0 && post.last_edited_at && formatTimeShort && new Date(post.last_edited_at).getTime() - new Date(post.created_at).getTime() > 5 * 60 * 1000}
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
                    </div>
                </div>
            {/if}

            <div
                class="text-secondary-foreground ml-auto flex gap-2 sm:gap-4"
                style="font-size: 0.85em;"
            >
                <span>조회 {post.views.toLocaleString()}</span>
                <span>공감 {likeCount.toLocaleString()}</span>
                <button
                    type="button"
                    class="hover:text-foreground transition-colors"
                    onclick={() =>
                        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}
                    >댓글 {post.comments_count.toLocaleString()}</button
                >
            </div>
        </div>

        <!-- 별점 위젯 (앙티티 Phase 0): features.rating 보드에서만 백엔드가
             post.rating 을 동봉 → 없으면 렌더 0 (전 게시판 회귀 0) -->
        {#if post.rating}
            <PostRatingWidget {boardId} postId={post.id} initial={post.rating} />
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

        <!-- 글자 크기 조절 -->
        <div class="mb-1 flex items-center justify-end gap-1">
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground active:bg-muted border-border hover:bg-muted rounded border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-30"
                disabled={currentFontSize === 'small'}
                onclick={() => uiSettingsStore.changeContentFontSize(-1)}
                aria-label="글자 작게">- 작게</button
            >
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground active:bg-muted border-border hover:bg-muted rounded border px-2.5 py-1.5 text-xs transition-colors"
                onclick={() => uiSettingsStore.changeContentFontSize(0)}
                aria-label="글자 기본">보통</button
            >
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground active:bg-muted border-border hover:bg-muted rounded border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-30"
                disabled={currentFontSize === '3xlarge'}
                onclick={() => uiSettingsStore.changeContentFontSize(1)}
                aria-label="글자 크게">크게 +</button
            >
        </div>

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
                        <div class="mt-6 space-y-2">
                            <p
                                class="text-muted-foreground flex items-center gap-1.5 text-sm font-medium"
                            >
                                <Paperclip class="h-4 w-4" />
                                첨부파일
                            </p>
                            {#each post.downloads as file, i (i)}
                                <a
                                    href={file.url}
                                    download={file.filename}
                                    onclick={() => trackFileDownload(boardId, file.filename)}
                                    class="bg-muted/50 hover:bg-muted flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors"
                                >
                                    <Download class="text-muted-foreground h-4 w-4 shrink-0" />
                                    <span class="text-foreground min-w-0 truncate text-sm">
                                        {file.filename}
                                    </span>
                                    {#if file.size}
                                        <span
                                            class="text-muted-foreground ml-auto shrink-0 text-xs"
                                        >
                                            {formatFileSize(file.size)}
                                        </span>
                                    {/if}
                                </a>
                            {/each}
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
                                class="text-primary truncate hover:underline"
                                >{post.link1_display || post.link1}</a
                            >
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
                                class="text-primary truncate hover:underline"
                                >{post.link2_display || post.link2}</a
                            >
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

                <!-- 스크랩 + 공유 + 신고 (우측 정렬) -->
                <div class="ml-auto flex items-center gap-1">
                    {#if authStore.isAuthenticated}
                        <ScrapButton {boardId} postId={post.id} size="sm" variant="ghost" />
                    {/if}
                    {#if board?.use_sns}
                        <ShareButton {boardId} postId={post.id} title={post.title || ''} />
                    {/if}
                    {#if !isAuthor && !isLockedPost}
                        <!-- #12420: 이미 신고 누적으로 잠긴 글은 추가 신고 불가 -->
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
