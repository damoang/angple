<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Play from '@lucide/svelte/icons/play';
    import Pin from '@lucide/svelte/icons/pin';
    import { getMemberIconUrl, handleIconError } from '$lib/utils/member-icon.js';
    import { formatDate } from '$lib/utils/format-date.js';

    // Props
    let {
        post,
        displaySettings,
        href
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
    } = $props();

    // 회원 아이콘 URL
    const iconUrl = $derived(getMemberIconUrl(post.author_id));

    // 추천 색상 단계 (PHP get_color_step_f20240616 재현)
    const likesStep = $derived.by(() => {
        const likes = post.likes;
        if (likes === 0) return 'step0';
        if (likes <= 5) return 'step1';
        if (likes <= 10) return 'step2';
        if (likes <= 50) return 'step3';
        return 'step4';
    });

    const stepClasses: Record<string, string> = {
        step0: 'bg-muted text-muted-foreground',
        step1: 'bg-accent text-accent-foreground',
        step2: 'bg-secondary text-secondary-foreground',
        step3: 'bg-liked/10 text-liked',
        step4: 'bg-destructive/10 text-destructive'
    };

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
</script>

<!-- Classic 스킨: PHP list 스킨 1:1 재현 (추천|제목|이름|날짜|조회) -->
{#if isDeleted}
    <div class="bg-background px-4 py-2.5 opacity-50">
        <div class="flex items-center gap-2 md:gap-3">
            <div class="hidden shrink-0 md:block">
                <div
                    class="bg-muted text-muted-foreground flex h-7 w-10 items-center justify-center rounded-md text-sm font-semibold"
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
        class="bg-background hover:bg-accent block px-4 py-2.5 no-underline transition-colors"
        data-sveltekit-preload-data="hover"
    >
        <div class="flex items-center gap-2 md:gap-3">
            <!-- 추천 박스 (데스크톱만) -->
            <div class="hidden shrink-0 md:block">
                {#if post.is_notice}
                    <div class="bg-liked/10 flex h-7 w-10 items-center justify-center rounded-md">
                        <Pin class="text-liked h-4 w-4" />
                    </div>
                {:else}
                    <div
                        class="flex h-7 w-10 items-center justify-center rounded-md text-sm font-semibold {stepClasses[
                            likesStep
                        ]}"
                    >
                        {post.likes.toLocaleString()}
                    </div>
                {/if}
            </div>

            <!-- 제목 + 메타 영역 -->
            <div class="min-w-0 flex-1">
                <div class="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
                    <!-- 제목 줄 -->
                    <div class="flex min-w-0 flex-1 items-center gap-1">
                        {#if post.is_notice}
                            <Pin class="text-liked h-3.5 w-3.5 shrink-0 md:hidden" />
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
                        <span class="text-foreground truncate text-base font-semibold">
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
                            <span class="text-liked shrink-0 text-[13px] font-semibold"
                                >+{post.comments_count}</span
                            >
                        {/if}
                    </div>

                    <!-- 메타 그룹 (데스크톱: 고정 너비 칼럼) -->
                    <div class="hidden shrink-0 items-center gap-2 md:flex">
                        <span
                            class="text-muted-foreground inline-flex w-[120px] items-center gap-1 truncate text-[15px]"
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
                        </span>
                        <span class="text-muted-foreground w-[70px] text-center text-[15px]">
                            {formatDate(post.created_at)}
                        </span>
                        <span class="text-muted-foreground w-[50px] text-center text-[15px]">
                            {post.views.toLocaleString()}
                        </span>
                    </div>

                    <!-- 메타 그룹 (모바일: 한 줄 나열) -->
                    <div
                        class="text-muted-foreground flex flex-wrap items-center gap-2 text-[15px] md:hidden"
                    >
                        <span class="inline-flex items-center gap-1">
                            {#if iconUrl}
                                <img
                                    src={iconUrl}
                                    alt=""
                                    class="h-5 w-5 shrink-0 rounded-full object-cover"
                                    onerror={handleIconError}
                                />
                            {/if}
                            {post.author}
                        </span>
                        <span>·</span>
                        <span>{formatDate(post.created_at)}</span>
                        <span>·</span>
                        <span>조회 {post.views.toLocaleString()}</span>
                        {#if post.likes > 0}
                            <span>·</span>
                            <span class="inline-flex items-center gap-0.5">
                                <span
                                    class="inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold {stepClasses[
                                        likesStep
                                    ]}"
                                >
                                    👍 {post.likes}
                                </span>
                            </span>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </a>
{/if}
