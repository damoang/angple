<script lang="ts">
    /**
     * Muzia Feed — React FeedSection 디자인 그대로 + DB 실제 데이터만
     */
    import { Button } from '$lib/components/ui/button';

    interface FeedPost {
        id: number; board_id: string; board_name: string; title: string;
        author: string; author_id: string; created_at: string;
        views: number; likes: number; comments_count: number;
        image: string | null; youtube_id: string | null; excerpt: string;
    }

    let selectedTab = $state('all');
    let posts = $state<FeedPost[]>([]);
    let loading = $state(true);
    let likedIds = $state<Set<number>>(new Set());

    const tabs = [
        { id: 'all', label: '전체' },
        { id: 'best', label: '👑 베스트' },
        { id: 'gallery', label: '🖼️ 갤러리' },
    ];

    function loadFeed(tab: string) {
        loading = true;
        fetch(`/api/muzia/feed?per_page=20&tab=${tab}`).then(r => r.json()).then(d => {
            if (d.success) posts = d.data.posts;
        }).finally(() => loading = false);
    }

    $effect(() => { loadFeed(selectedTab === 'gallery' ? 'best' : selectedTab); });

    function toggleLike(id: number) {
        if (likedIds.has(id)) { likedIds.delete(id); likedIds = new Set(likedIds); }
        else { likedIds.add(id); likedIds = new Set(likedIds); }
    }
    function getColor(name: string) {
        const c = ['from-pink-400 to-rose-500','from-purple-400 to-indigo-500','from-blue-400 to-cyan-500','from-emerald-400 to-teal-500','from-amber-400 to-orange-500','from-red-400 to-pink-500'];
        let h = 0; for (const x of (name||'?')) h = x.charCodeAt(0) + ((h << 5) - h); return c[Math.abs(h) % c.length];
    }
    function timeAgo(d: string) {
        const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff/60000);
        if (m < 1) return '방금'; if (m < 60) return `${m}분 전`;
        const h = Math.floor(m/60); if (h < 24) return `${h}시간 전`;
        const dy = Math.floor(h/24); if (dy < 30) return `${dy}일 전`;
        return new Date(d).toLocaleDateString('ko-KR');
    }
</script>

<div class="container mx-auto px-4 py-6">
    <!-- 탭 -->
    <div class="mb-6 flex justify-center">
        <div class="mx-auto grid w-full max-w-sm grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {#each tabs as tab}
                <button class="rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors {selectedTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                    onclick={() => selectedTab = tab.id}>{tab.label}</button>
            {/each}
        </div>
    </div>

    {#if loading}
        <div class="py-20 text-center text-muted-foreground">로딩 중...</div>
    {:else if selectedTab === 'gallery'}
        <!-- 갤러리 (이미지 있는 게시글만) -->
        <div class="rounded-lg border bg-card p-4 shadow-sm">
            <h3 class="mb-4 flex items-center gap-2 text-lg font-semibold">🔥 인기 갤러리</h3>
            <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
                {#each posts.filter(p => p.image) as item}
                    <a href="/{item.board_id}/{item.id}" class="group relative cursor-pointer">
                        <img src={item.image} alt={item.title} class="h-48 w-full rounded-lg object-cover transition-transform group-hover:scale-105" />
                        <div class="absolute inset-0 flex items-end rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <div class="w-full p-3 text-white">
                                <p class="text-sm font-medium line-clamp-1">{item.title}</p>
                                <div class="flex items-center justify-between text-xs">
                                    <span>{item.author}</span>
                                    <span>❤️ {item.likes}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        </div>
    {:else}
        <!-- 통합 피드 (React FeedSection 디자인 그대로) -->
        <div class="mx-auto max-w-2xl space-y-6">
            {#each posts as post (post.id)}
                {@const liked = likedIds.has(post.id)}
                <div class="overflow-hidden rounded-lg border bg-card shadow-sm">
                    <!-- 유저 정보 -->
                    <div class="flex items-center justify-between p-4">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r {getColor(post.author)} text-sm font-bold text-white">
                                {post.author?.[0] || '?'}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-medium">{post.author}</span>
                                    <span class="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{post.board_name}</span>
                                    {#if post.likes >= 3}
                                        <span class="rounded bg-gradient-to-r from-yellow-400 to-orange-500 px-2 py-0.5 text-xs font-medium text-white">👑 BEST</span>
                                    {/if}
                                </div>
                                <span class="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon"><span>⋯</span></Button>
                    </div>

                    <!-- 제목 -->
                    <a href="/{post.board_id}/{post.id}" class="block px-4 pb-2 hover:text-primary">
                        <h3 class="text-lg font-semibold">{post.title}</h3>
                    </a>

                    <!-- 이미지 or YouTube 썸네일 -->
                    {#if post.image}
                        <a href="/{post.board_id}/{post.id}" class="relative block">
                            <img src={post.image} alt="" class="h-80 w-full object-cover" />
                            {#if post.youtube_id}
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <div class="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 text-2xl text-white shadow-lg">▶</div>
                                </div>
                            {/if}
                            {#if post.views > 0}
                                <div class="absolute right-3 top-3"><span class="rounded bg-black/50 px-2 py-1 text-xs text-white">👁️ {post.views.toLocaleString()}</span></div>
                            {/if}
                        </a>
                    {/if}

                    <!-- 하단 -->
                    <div class="p-4">
                        <!-- 액션 버튼 -->
                        <div class="mb-3 flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <button class="text-xl transition-transform hover:scale-110 {liked ? 'text-red-500' : ''}" onclick={() => toggleLike(post.id)}>
                                    {liked ? '❤️' : '🤍'}
                                </button>
                                <a href="/{post.board_id}/{post.id}" class="text-xl transition-transform hover:scale-110">💬</a>
                                <button class="text-xl transition-transform hover:scale-110">↗️</button>
                            </div>
                            <button class="text-xl transition-transform hover:scale-110">🔖</button>
                        </div>

                        {#if post.likes > 0 || liked}
                            <p class="mb-2 font-medium">좋아요 {(post.likes + (liked ? 1 : 0)).toLocaleString()}개</p>
                        {/if}

                        <!-- 콘텐츠 미리보기 -->
                        {#if post.excerpt}
                            <p class="mb-3 text-sm text-foreground/80">
                                <span class="font-medium">{post.author}</span> {post.excerpt}
                            </p>
                        {/if}

                        <!-- 댓글 입력 -->
                        <div class="flex items-center gap-2 border-t pt-3">
                            <input type="text" placeholder="댓글 달기..." class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                            <button class="text-sm font-semibold text-primary opacity-50">게시</button>
                        </div>

                        {#if post.comments_count > 0}
                            <a href="/{post.board_id}/{post.id}" class="mt-2 block text-sm text-muted-foreground hover:text-foreground">
                                댓글 {post.comments_count}개 모두 보기
                            </a>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
