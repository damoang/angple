<script lang="ts">
    import { onMount } from 'svelte';
    import type { GroupPost } from '$lib/api/types.js';
    import Heart from '@lucide/svelte/icons/heart';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import {
        formatNumber,
        getRecommendBadgeClass,
        shortenBoardName
    } from '../../../recommended/utils/index.js';

    type Props = {
        posts: GroupPost[];
    };

    let { posts }: Props = $props();

    // URL에서 boardId 추출 (/{boardId}/{postId} 형태)
    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }

    // 읽은 글 표시 (하이드레이션 깜빡임 방지)
    let showReadState = $state(false);
    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });
</script>

{#if posts.length > 0}
    <ul class="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-4">
        {#each posts as post (post.id)}
            <li>
                <!--
                    ⭐ 터치 타깃 최소 44px (구글·애플 공통 권장). 이 링크는 36px 이고 인접 간격이
                       0px 이라 손가락이 두 링크에 걸쳤다 — 실사용자 오터치 계측에서 홈만 하루 542건,
                       어긋난 px 의 87%가 10~39px 로 링크 높이 자체와 일치했다(행 밀림이 아니다).
                    ⛔ padding 을 키워서 44px 을 만들지 말 것. --row-pad-extra 는 회원의 UI 밀도
                       설정(compact 0 / balanced 3 / relaxed 6px)이라 곱해지면 relaxed 가 56px 로
                       과해진다. min-height 는 바닥만 보장하므로 밀도를 크게 쓰는 회원 설정은 그대로다.
                    ⛔ 인라인 style 이 Tailwind 클래스를 이긴다 — 아래 padding 계산식 때문에 class 의
                       py-* 는 이미 무시되고 있다. 그래서 display 도 인라인에 두고 class 에서 block 을
                       지웠다. 남겨두면 「class 는 block 인데 실제 동작은 flex」라는 거짓이 하나 더
                       생긴다(py-* 가 이미 같은 방식으로 사람을 속였다).
                -->
                <a
                    href={post.url}
                    class="hover:bg-muted rounded px-0.5 py-1.5 transition-all duration-200 ease-out"
                    style="min-height: 44px; display: flex; flex-direction: column; justify-content: center; padding-top: calc(0.125rem + var(--row-pad-extra, 0px)); padding-bottom: calc(0.125rem + var(--row-pad-extra, 0px));"
                >
                    <div class="flex items-center gap-1">
                        <!-- 추천수 배지 -->
                        <span
                            class="inline-flex w-[2.75rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                                post.recommend_count
                            )}"
                        >
                            <Heart class="size-3" />
                            {formatNumber(post.recommend_count)}
                        </span>

                        <!-- 게시판 뱃지 -->
                        {#if post.board_name}
                            <span
                                class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
                            >
                                {shortenBoardName(post.board_name)}
                            </span>
                        {/if}

                        <!-- 제목 -->
                        <span
                            class="min-w-0 flex-1 truncate leading-relaxed {getReadPostClasses(
                                showReadState &&
                                    readPostsStore.isRead(
                                        post.board || getBoardId(post.url),
                                        post.id
                                    )
                            )}"
                            style="font-size: var(--list-font-size);"
                        >
                            {post.title}
                        </span>
                    </div>
                </a>
            </li>
        {/each}
    </ul>
{:else}
    <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-muted-foreground text-sm">아직 글이 없어요</p>
    </div>
{/if}
