<script lang="ts">
    /**
     * 축하 메시지 카드 레이아웃
     *
     * 회원 축하/기념 게시글을 카드 형태로 표시합니다.
     * - 그라데이션 헤더 (회원 아이디 기반 일관된 색상)
     * - 무지개 테두리 회전 애니메이션 아바타
     * - 배너 이미지 오버레이
     *
     * Design System: "Soft Modern" - 부드러운 카드, 호버 리프트 효과
     */
    import { Card } from '$lib/components/ui/card';
    import User from '@lucide/svelte/icons/user';
    import Heart from '@lucide/svelte/icons/heart';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    interface MessagePost {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: {
            id?: string;
            nickname?: string;
            avatar_url?: string;
            profile_url?: string;
        };
        external_link?: string;
        created_at?: string;
    }

    let {
        posts = [],
        showTitle = true,
        boardId = ''
    }: {
        posts: MessagePost[];
        showTitle?: boolean;
        boardId?: string;
    } = $props();

    // 회원 아이디 기반 그라데이션 번호 (1-5, 일관된 색상)
    function getGradientNumber(memberId?: string): number {
        if (!memberId) return Math.floor(Math.random() * 5) + 1;
        let hash = 0;
        for (let i = 0; i < memberId.length; i++) {
            hash = (hash << 5) - hash + memberId.charCodeAt(i);
            hash |= 0;
        }
        return (Math.abs(hash) % 5) + 1;
    }

    // 그라데이션 색상 매핑
    const gradients: Record<number, { header: string; avatar: string }> = {
        1: {
            header: 'from-indigo-500 to-purple-600',
            avatar: 'from-indigo-500 to-purple-600'
        },
        2: {
            header: 'from-pink-400 to-rose-500',
            avatar: 'from-pink-400 to-rose-500'
        },
        3: {
            header: 'from-cyan-400 to-teal-500',
            avatar: 'from-cyan-400 to-teal-500'
        },
        4: {
            header: 'from-emerald-400 to-cyan-500',
            avatar: 'from-emerald-400 to-cyan-500'
        },
        5: {
            header: 'from-rose-400 to-amber-400',
            avatar: 'from-rose-400 to-amber-400'
        }
    };
</script>

<Card class="gap-0 overflow-hidden">
    {#if showTitle}
        <div class="border-border flex items-center gap-2 border-b px-4 py-2.5">
            <Heart class="h-4 w-4 text-rose-500" />
            <h3 class="text-sm font-semibold">축하 메시지</h3>
        </div>
    {/if}

    {#if posts.length === 0}
        <!-- 빈 상태: "Inviting Spaces" -->
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <div
                class="mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-5xl text-transparent"
            >
                <Heart class="h-12 w-12" />
            </div>
            <p class="text-foreground text-lg font-semibold">아직 축하 메시지가 없습니다</p>
            <p class="text-muted-foreground mt-1 text-sm">첫 번째 축하 메시지를 남겨보세요!</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {#each posts as post (post.id)}
                {@const gradNum = getGradientNumber(post.author?.id)}
                {@const grad = gradients[gradNum]}
                <div
                    class="border-border bg-background group flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg"
                >
                    <!-- 상단 헤더: 그라데이션 + 닉네임 -->
                    <div
                        class="flex items-center gap-2 bg-gradient-to-r px-3 py-2 text-white {grad.header}"
                    >
                        <Heart class="h-4 w-4" />
                        <span class="text-sm font-bold drop-shadow-md">
                            {post.author?.nickname ?? '축하합니다'}
                            {post.author?.nickname ? '님' : ''}
                        </span>
                        {#if post.external_link}
                            <a
                                href={post.external_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="ml-auto flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs transition-colors hover:bg-white/30"
                            >
                                <ExternalLink class="h-3 w-3" />
                                바로가기
                            </a>
                        {/if}
                    </div>

                    <!-- 본문: 프로필 + 배너 -->
                    <div class="relative flex min-h-[70px] flex-1">
                        <!-- 프로필 아바타 (왼쪽 중앙) -->
                        <div class="absolute left-3 top-1/2 z-10 -translate-y-1/2">
                            {#if post.author?.profile_url}
                                <a
                                    href={post.author.profile_url}
                                    class="block transition-transform duration-200 hover:scale-110"
                                >
                                    {#if post.author?.avatar_url}
                                        <img
                                            src={post.author.avatar_url}
                                            alt=""
                                            class="rainbow-border h-14 w-14 rounded-full border-[3px] border-transparent object-cover shadow-lg"
                                            loading="lazy"
                                        />
                                    {:else}
                                        <div
                                            class="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white/50 bg-gradient-to-br text-white shadow-lg {grad.avatar}"
                                        >
                                            <User class="h-6 w-6" />
                                        </div>
                                    {/if}
                                </a>
                            {:else if post.author?.avatar_url}
                                <img
                                    src={post.author.avatar_url}
                                    alt=""
                                    class="rainbow-border h-14 w-14 rounded-full border-[3px] border-transparent object-cover shadow-lg"
                                    loading="lazy"
                                />
                            {:else}
                                <div
                                    class="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white/50 bg-gradient-to-br text-white shadow-lg {grad.avatar}"
                                >
                                    <User class="h-6 w-6" />
                                </div>
                            {/if}
                        </div>

                        <!-- 배너 이미지 or 텍스트 영역 -->
                        {#if post.thumbnail_url}
                            <a href={post.url ?? '#'} class="block w-full overflow-hidden">
                                <div class="relative h-full w-full">
                                    <img
                                        src={post.thumbnail_url}
                                        alt={post.title}
                                        class="h-full min-h-[70px] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                        loading="lazy"
                                    />
                                    <!-- 오버레이 -->
                                    <div
                                        class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 pl-20"
                                    >
                                        <p
                                            class="line-clamp-2 text-sm font-semibold text-white drop-shadow-md"
                                        >
                                            {post.title}
                                        </p>
                                    </div>
                                </div>
                            </a>
                        {:else}
                            <a
                                href={post.url ?? '#'}
                                class="bg-muted flex w-full flex-col justify-center py-4 pl-20 pr-4"
                            >
                                <p class="text-foreground line-clamp-2 text-sm font-semibold">
                                    {post.title}
                                </p>
                            </a>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</Card>

<style>
    /* 무지개 테두리 회전 애니메이션 */
    @property --border-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
    }

    @keyframes rainbow-rotate {
        from {
            --border-angle: 0deg;
        }
        to {
            --border-angle: 360deg;
        }
    }

    .rainbow-border {
        --border-angle: 0deg;
        background:
            linear-gradient(white, white) padding-box,
            conic-gradient(
                    from var(--border-angle),
                    #ff0000,
                    #ff8000,
                    #ffff00,
                    #80ff00,
                    #00ff80,
                    #00ffff,
                    #0080ff,
                    #8000ff,
                    #ff00ff,
                    #ff0000
                )
                border-box;
        animation: rainbow-rotate 3s linear infinite;
    }

    :global(.dark) .rainbow-border {
        background:
            linear-gradient(#1f2937, #1f2937) padding-box,
            conic-gradient(
                    from var(--border-angle),
                    #ff0000,
                    #ff8000,
                    #ffff00,
                    #80ff00,
                    #00ff80,
                    #00ffff,
                    #0080ff,
                    #8000ff,
                    #ff00ff,
                    #ff0000
                )
                border-box;
    }
</style>
