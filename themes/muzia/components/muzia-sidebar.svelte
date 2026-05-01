<script lang="ts">
    /**
     * Muzia Sidebar — React Sidebar.tsx 1:1 변환
     * 원본과 동일한 클래스/구조/데이터
     */
    import { Button } from '$lib/components/ui/button';
    import MuziaAdSlot from './muzia-ad-slot.svelte';
    import { page } from '$app/stores';
    import { getLang } from '$lib/i18n/store.svelte';
    import { MESSAGES } from '$lib/i18n/messages';

    function isActive(href: string): boolean {
        const p = $page.url.pathname;
        if (href === '/') return p === '/';
        return p === href || p.startsWith(href + '/');
    }

    interface MenuItem {
        icon: string;
        label: string;
        href: string;
        children?: { icon: string; label: string; href: string }[];
    }

    const menuItems = $derived.by<MenuItem[]>(() => {
        const m = MESSAGES[getLang()].nav;
        const c = MESSAGES[getLang()].cards;
        return [
            { icon: '🏠', label: m.home, href: '/' },
            { icon: '📅', label: m.attendance, href: '/attendance' },
            { icon: '💬', label: m.qna, href: '/qna' },
            { icon: '📝', label: m.forum, href: '/forum' },
            { icon: '🎵', label: m.music, href: '/music' },
            { icon: '🎻', label: m.violin, href: '/violin' },
            { icon: '🎼', label: m.sibelius, href: '/sibelius' },
            { icon: '🎹', label: m.dorico, href: '/dorico' },
            {
                icon: '🛠️', label: m.tools, href: '/tools',
                children: [
                    { icon: '🎵', label: c.metronome.title, href: '/tools/metronome' },
                    { icon: '🎸', label: c.tuner.title, href: '/tools/tuner' },
                    { icon: '⏱️', label: c.bpmTap.title, href: '/tools/bpm-tap' },
                    { icon: '🎹', label: c.chordProgression.title, href: '/tools/chord-progression' },
                    { icon: '📚', label: c.musicTheory.title, href: '/tools/music-theory' },
                    { icon: '🎹', label: c.pianoRoll.title, href: '/tools/piano-roll' },
                    { icon: '🎼', label: c.abcNotation.title, href: '/tools/abc-notation' },
                    { icon: '📜', label: c.scoreEditor.title, href: '/tools/score-editor' },
                    { icon: '🎚️', label: c.midiSequencer.title, href: '/tools/midi-sequencer' },
                    { icon: '📖', label: c.scaleDictionary.title, href: '/tools/scale-dictionary' },
                    { icon: '📚', label: c.chordDictionary.title, href: '/tools/chord-dictionary' },
                    { icon: '👂', label: c.intervalTrainer.title, href: '/tools/interval-trainer' }
                ]
            },
            { icon: '💡', label: m.tip, href: '/tip' },
            { icon: '📢', label: m.notice, href: '/notice' },
            { icon: '👋', label: m.hello, href: '/hello' }
        ];
    });

    let toolsExpanded = $state(false);
    const isOnTools = $derived($page.url.pathname.startsWith('/tools'));
    const showToolsChildren = $derived(toolsExpanded || isOnTools);

    interface RecentPost { id: number; board_id: string; title: string; author: string; created_at: string; comments_count: number; }
    interface RecentComment { id: number; board_id: string; parent_id: number; author: string; content: string; created_at: string; }

    let recentPosts = $state<RecentPost[]>([]);
    let recentComments = $state<RecentComment[]>([]);

    // 모듈 레벨 캐시 (네비게이션 시 재호출 방지, 5분 TTL)
    let _cache: { posts: RecentPost[]; comments: RecentComment[]; ts: number } | null = null;
    const CACHE_TTL = 5 * 60 * 1000;

    $effect(() => {
        const now = Date.now();
        if (_cache && now - _cache.ts < CACHE_TTL) {
            recentPosts = _cache.posts;
            recentComments = _cache.comments;
            return;
        }
        Promise.all([
            fetch('/api/muzia/recent?type=posts&limit=5').then(r => r.json()),
            fetch('/api/muzia/recent?type=comments&limit=5').then(r => r.json())
        ]).then(([p, c]) => {
            if (p.success) recentPosts = p.data;
            if (c.success) recentComments = c.data;
            _cache = { posts: recentPosts, comments: recentComments, ts: Date.now() };
        });
    });
</script>

<div class="h-full overflow-y-auto border-r bg-background p-4">
    <!-- 네비게이션 (2-depth 도구 메뉴 지원) -->
    <nav class="mb-6 space-y-1">
        {#each menuItems as item}
            {#if item.children}
                <div class="space-y-1">
                    <div class="flex items-center gap-1">
                        <a href={item.href} class="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors
                            {isActive(item.href) ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-accent'}">
                            <span>{item.icon}</span>
                            {item.label}
                        </a>
                        <button
                            class="rounded-lg px-2 py-2.5 text-xs hover:bg-accent transition-colors"
                            onclick={() => toolsExpanded = !toolsExpanded}
                            aria-label="Toggle submenu"
                            aria-expanded={showToolsChildren}
                        >
                            {showToolsChildren ? '▴' : '▾'}
                        </button>
                    </div>
                    {#if showToolsChildren}
                        <div class="ml-4 space-y-0.5 border-l border-border pl-3 py-1">
                            {#each item.children as child}
                                <a
                                    href={child.href}
                                    class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors
                                        {isActive(child.href) ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-950 dark:text-indigo-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                                >
                                    <span class="text-sm">{child.icon}</span>
                                    <span class="truncate">{child.label}</span>
                                </a>
                            {/each}
                        </div>
                    {/if}
                </div>
            {:else}
                <a href={item.href} class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors
                    {isActive(item.href) ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-accent'}">
                    <span>{item.icon}</span>
                    {item.label}
                </a>
            {/if}
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

    <!-- 사이드바 광고 -->
    <MuziaAdSlot position="sidebar" class="mt-4" />
</div>
