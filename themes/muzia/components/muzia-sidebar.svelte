<script lang="ts">
    /**
     * Muzia Sidebar — React Sidebar.tsx 1:1 변환
     * 원본과 동일한 클래스/구조/데이터
     */
    import { Button } from '$lib/components/ui/button';

    const menuItems = [
        { icon: '🏠', label: '홈', href: '/' },
        { icon: '📅', label: '출석부', href: '/attendance' },
        { icon: '💬', label: 'Q&A', href: '/qna' },
        { icon: '📝', label: '포럼', href: '/forum' },
        { icon: '🎵', label: '음악', href: '/music' },
        { icon: '🎻', label: '바이올린', href: '/violin' },
        { icon: '🎼', label: '시벨리우스', href: '/sibelius' },
        { icon: '💡', label: '강좌/팁', href: '/tip' },
        { icon: '📢', label: '공지사항', href: '/notice' },
        { icon: '👋', label: '가입인사', href: '/hello' },
    ];

    interface RecentPost { id: number; board_id: string; title: string; author: string; created_at: string; comments_count: number; }
    interface RecentComment { id: number; board_id: string; parent_id: number; author: string; content: string; created_at: string; }

    let recentPosts = $state<RecentPost[]>([]);
    let recentComments = $state<RecentComment[]>([]);

    $effect(() => {
        fetch('/api/muzia/recent?type=posts&limit=5').then(r => r.json()).then(d => { if (d.success) recentPosts = d.data; });
        fetch('/api/muzia/recent?type=comments&limit=5').then(r => r.json()).then(d => { if (d.success) recentComments = d.data; });
    });
</script>

<div class="h-full overflow-y-auto border-r bg-background p-4">
    <!-- 네비게이션 (React 원본과 동일) -->
    <nav class="mb-6 space-y-1">
        {#each menuItems as item}
            <a href={item.href} class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent">
                <span>{item.icon}</span>
                {item.label}
            </a>
        {/each}
    </nav>

    <!-- 최근 글 -->
    <div class="mb-6 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <h3 class="flex items-center gap-2 pb-3 text-base font-semibold">📝 최근 글</h3>
        <div class="space-y-3">
            {#each recentPosts as post}
                <div class="space-y-1">
                    <a href="/{post.board_id}/{post.id}" class="cursor-pointer text-sm hover:text-primary line-clamp-1">
                        {post.title}
                    </a>
                    <div class="flex items-center justify-between">
                        <span class="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{post.board_id}</span>
                        <span class="text-xs text-muted-foreground">{post.author}</span>
                    </div>
                </div>
            {:else}
                <p class="text-sm text-muted-foreground">로딩 중...</p>
            {/each}
        </div>
    </div>

    <!-- 최근 댓글 -->
    <div class="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <h3 class="flex items-center gap-2 pb-3 text-base font-semibold">💬 최근 댓글</h3>
        <div class="space-y-3">
            {#each recentComments as comment}
                <div class="space-y-1">
                    <a href="/{comment.board_id}/{comment.parent_id}" class="cursor-pointer text-sm hover:text-primary line-clamp-1">
                        {comment.content.replace(/<[^>]*>/g, '').slice(0, 40)}
                    </a>
                    <div class="flex items-center justify-between">
                        <span class="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{comment.board_id}</span>
                        <span class="text-xs text-muted-foreground">{comment.author}</span>
                    </div>
                </div>
            {:else}
                <p class="text-sm text-muted-foreground">로딩 중...</p>
            {/each}
        </div>
    </div>
</div>
