<script lang="ts">
    import type { Snippet } from 'svelte';
    import { page } from '$app/stores';

    interface Props { children: Snippet; }
    const { children }: Props = $props();
    const pathname = $derived($page.url.pathname);
    const isHomePage = $derived(pathname === '/');

    // 게시판 경로 감지
    const boardPages = ['youtube', 'weekly', 'news', 'gallery', 'notice', 'freeboard', 'broad', 'score', 'choir', 'school', 'message', 'bible'];
    const currentBoard = $derived(boardPages.find(b => pathname === '/' + b) || null);

    // 게시글 상세 감지: /boardId/postId
    const postMatch = $derived(() => {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length === 2 && /^\d+$/.test(parts[1]) && boardPages.includes(parts[0])) {
            return { board: parts[0], postId: parts[1] };
        }
        return null;
    });

    // 게시글 상세 데이터
    interface PostDetail { id: number; title: string; content: string; author: string; datetime: string; views: number; link1: string; }
    interface Comment { id: number; content: string; author: string; datetime: string; }
    let postDetail = $state<PostDetail | null>(null);
    let postComments = $state<Comment[]>([]);
    let postLoading = $state(false);

    $effect(() => {
        const m = postMatch();
        if (m) {
            postLoading = true;
            fetch(`/api/hdbc/post?board=${m.board}&id=${m.postId}`)
                .then(r => r.json())
                .then(d => { if (d.success) { postDetail = d.data.post; postComments = d.data.comments; } })
                .finally(() => postLoading = false);
        }
    });

    // 게시판 목록 데이터
    interface BoardPost { id: number; title: string; author: string; datetime: string; board: string; image?: string; }
    let boardPosts = $state<BoardPost[]>([]);
    let boardLoading = $state(false);

    $effect(() => {
        if (currentBoard) {
            boardLoading = true;
            fetch(`/api/hdbc/posts?board=${currentBoard}&limit=20`)
                .then(r => r.json())
                .then(d => { if (d.success) boardPosts = d.data; })
                .finally(() => boardLoading = false);
        }
    });

    // YouTube 게시판은 별도 처리
    interface YouTubeItem { id: number; title: string; link: string; datetime: string; }
    let youtubeList = $state<YouTubeItem[]>([]);

    $effect(() => {
        if (currentBoard === 'youtube') {
            fetch('/api/hdbc/youtube?limit=20').then(r => r.json()).then(d => { if (d.success) youtubeList = d.data; });
        }
    });

    const navItems = [
        { label: '홈', href: '/' },
        { label: '설교', href: '/youtube' },
        { label: '주보', href: '/weekly' },
        { label: '교회소식', href: '/news' },
        { label: '갤러리', href: '/gallery' },
        { label: '공지', href: '/notice' },
        { label: '오시는 길', href: '/location' },
    ];

    let mobileMenuOpen = $state(false);

    // YouTube 최신 영상
    interface YouTubePost { id: number; title: string; link: string; datetime: string; }
    let latestVideo = $state<YouTubePost | null>(null);
    let recentVideos = $state<YouTubePost[]>([]);

    // 공지/소식
    interface Post { id: number; board: string; title: string; author: string; datetime: string; }
    let notices = $state<Post[]>([]);
    let news = $state<Post[]>([]);

    function extractYouTubeId(url: string): string | null {
        const m = url?.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    $effect(() => {
        // YouTube 영상 로드
        fetch('/api/hdbc/youtube').then(r => r.json()).then(d => {
            if (d.success && d.data.length > 0) {
                latestVideo = d.data[0];
                recentVideos = d.data.slice(1, 4);
            }
        }).catch(() => {});

        // 공지 + 소식
        fetch('/api/hdbc/posts?board=notice&limit=3').then(r => r.json()).then(d => { if (d.success) notices = d.data; }).catch(() => {});
        fetch('/api/hdbc/posts?board=news&limit=3').then(r => r.json()).then(d => { if (d.success) news = d.data; }).catch(() => {});
    });
</script>

<svelte:head>
    <title>흥덕침례교회 — 함께하는 은혜, 나누는 사랑</title>
    <meta name="description" content="흥덕침례교회에 오신 것을 환영합니다. 청주에서 하나님의 사랑을 나누는 공동체입니다." />
    <meta property="og:title" content="흥덕침례교회" />
    <meta property="og:description" content="함께하는 은혜, 나누는 사랑" />
    <link rel="canonical" href="https://hdbc.kr" />
    <style>
        :root { --hdbc-primary: #5D4037; --hdbc-accent: #8D6E63; --hdbc-bg: #FFF8F0; --hdbc-border: #E0D0C0; --hdbc-muted: #A1887F; }
    </style>
</svelte:head>

<div class="flex min-h-screen flex-col" style="background: #FFF8F0;">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b" style="border-color: #E0D0C0; background: rgba(255,248,240,0.95); backdrop-filter: blur(8px);">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <img src="https://hdbc.kr/theme/_NB-Basic/storage/image/logo-hdbclog.jpg" alt="흥덕침례교회" class="h-12 rounded" />
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[#F0E0CC] {$page.url.pathname === item.href ? 'bg-[#F0E0CC] font-bold' : ''}" style="color: #5D4037;">{item.label}</a>
                {/each}
            </nav>
            <button class="rounded-lg p-2 hover:bg-[#F0E0CC] lg:hidden" style="color: #5D4037;" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t px-4 py-3 lg:hidden" style="border-color: #E0D0C0; background: #FFF8F0;">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm hover:bg-[#F0E0CC]" style="color: #5D4037;" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden py-28 text-center text-white" style="background: linear-gradient(135deg, #5D4037, #795548, #8D6E63);">
            <div class="absolute inset-0 opacity-5" style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Cpath d=%22M40 10v25M40 45v25M10 40h25M45 40h25%22 stroke=%22white%22 stroke-width=%221%22 fill=%22none%22/%3E%3C/svg%3E');"></div>
            <div class="relative mx-auto max-w-4xl px-4">
                <p class="mb-4 text-sm font-medium uppercase tracking-widest opacity-70">Heungdeok Baptist Church</p>
                <h1 class="mb-6 font-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">함께하는 은혜,<br/>나누는 사랑</h1>
                <p class="mx-auto mb-10 max-w-xl text-lg opacity-90">흥덕침례교회에 오신 것을 환영합니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/youtube" class="rounded-full bg-white px-8 py-4 font-bold shadow-lg transition hover:shadow-xl" style="color: #5D4037;">이번 주 설교 보기</a>
                    <a href="/notice" class="rounded-full border-2 border-white/40 px-8 py-4 font-medium backdrop-blur transition hover:bg-white/10">교회 소식</a>
                </div>
            </div>
        </section>

        <!-- 이번 주 설교 (YouTube 임베드) -->
        {#if latestVideo}
            <section class="py-16">
                <div class="mx-auto max-w-4xl px-4">
                    <h2 class="mb-8 text-center font-serif text-3xl font-bold" style="color: #5D4037;">이번 주 설교</h2>
                    {#if extractYouTubeId(latestVideo.link)}
                        <div class="overflow-hidden rounded-2xl shadow-lg" style="border: 1px solid #E0D0C0;">
                            <div class="relative" style="padding-bottom: 56.25%;">
                                <iframe src="https://www.youtube.com/embed/{extractYouTubeId(latestVideo.link)}" title={latestVideo.title}
                                    class="absolute inset-0 h-full w-full" frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                            </div>
                        </div>
                        <p class="mt-4 text-center font-serif text-lg font-medium" style="color: #5D4037;">{latestVideo.title}</p>
                    {/if}

                    <!-- 지난 설교 -->
                    {#if recentVideos.length > 0}
                        <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {#each recentVideos as v}
                                {#if extractYouTubeId(v.link)}
                                    <a href="/youtube/{v.id}" class="group overflow-hidden rounded-xl shadow-sm transition hover:shadow-md" style="border: 1px solid #E0D0C0; background: white;">
                                        <img src="https://img.youtube.com/vi/{extractYouTubeId(v.link)}/mqdefault.jpg" alt={v.title} class="h-32 w-full object-cover transition-transform group-hover:scale-105" />
                                        <div class="p-3">
                                            <p class="text-xs font-medium line-clamp-2" style="color: #5D4037;">{v.title}</p>
                                        </div>
                                    </a>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- 말씀 -->
        <section class="py-8" style="border-top: 1px solid #E0D0C0; border-bottom: 1px solid #E0D0C0; background: linear-gradient(135deg, #5D4037, #8D6E63); color: white;">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <blockquote class="font-serif text-lg italic sm:text-xl">"하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니"</blockquote>
                <p class="mt-3 text-sm opacity-70">— 요한복음 3:16</p>
            </div>
        </section>

        <!-- 예배 안내 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center font-serif text-3xl font-bold" style="color: #5D4037;">예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['🙏', '주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 묵상의 시간'],
                        ['🌙', '금요기도', '금요일 오후 8:00', '은혜로운 기도의 밤'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-2xl bg-white p-6 text-center shadow-sm transition hover:shadow-md" style="border: 1px solid #E0D0C0;">
                            <div class="mb-3 text-4xl">{icon}</div>
                            <h3 class="mb-1 font-serif text-lg font-bold" style="color: #5D4037;">{title}</h3>
                            <p class="mb-2 text-sm font-semibold" style="color: #8D6E63;">{time}</p>
                            <p class="text-xs" style="color: #A1887F;">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 교회 소식 -->
        <section class="py-16" style="background: #F5EDE3;">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center font-serif text-3xl font-bold" style="color: #5D4037;">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <!-- 공지사항 -->
                    <div class="rounded-2xl bg-white p-6 shadow-sm" style="border: 1px solid #E0D0C0;">
                        <h3 class="mb-4 flex items-center gap-2 font-serif text-lg font-bold" style="color: #5D4037;">📢 공지사항</h3>
                        <div class="space-y-3">
                            {#each notices as n}
                                <a href="/notice/{n.id}" class="block rounded-lg p-2 text-sm transition hover:bg-[#FFF8F0]" style="color: #3E2723;">
                                    <p class="font-medium line-clamp-1">{n.title}</p>
                                    <p class="text-xs" style="color: #A1887F;">{new Date(n.datetime).toLocaleDateString('ko-KR')}</p>
                                </a>
                            {:else}
                                <p class="text-sm" style="color: #A1887F;">공지사항이 없습니다</p>
                            {/each}
                        </div>
                    </div>
                    <!-- 뉴스 -->
                    <div class="rounded-2xl bg-white p-6 shadow-sm" style="border: 1px solid #E0D0C0;">
                        <h3 class="mb-4 flex items-center gap-2 font-serif text-lg font-bold" style="color: #5D4037;">📰 교회 뉴스</h3>
                        <div class="space-y-3">
                            {#each news as n}
                                <a href="/news/{n.id}" class="block rounded-lg p-2 text-sm transition hover:bg-[#FFF8F0]" style="color: #3E2723;">
                                    <p class="font-medium line-clamp-1">{n.title}</p>
                                    <p class="text-xs" style="color: #A1887F;">{new Date(n.datetime).toLocaleDateString('ko-KR')}</p>
                                </a>
                            {:else}
                                <p class="text-sm" style="color: #A1887F;">뉴스가 없습니다</p>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 오시는 길 -->
        <section class="py-16">
            <div class="mx-auto max-w-4xl px-4 text-center">
                <h2 class="mb-6 font-serif text-3xl font-bold" style="color: #5D4037;">오시는 길</h2>
                <p style="color: #5D4037;">📍 충청북도 청주시 흥덕구</p>
                <p class="text-sm" style="color: #A1887F;">📞 교회 연락처</p>
            </div>
        </section>
    {:else if postMatch()}
        <!-- 게시글 상세 -->
        <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
            {#if postLoading}
                <p class="text-center" style="color: #A1887F;">로딩 중...</p>
            {:else if postDetail}
                <a href="/{postMatch()?.board}" class="mb-4 inline-block text-sm hover:underline" style="color: #A1887F;">← 목록으로</a>
                <div class="overflow-hidden rounded-2xl bg-white shadow-sm" style="border: 1px solid #E0D0C0;">
                    <div class="border-b p-6" style="border-color: #E0D0C0;">
                        <h1 class="mb-3 font-serif text-xl font-bold" style="color: #5D4037;">{postDetail.title}</h1>
                        <div class="flex items-center gap-3 text-xs" style="color: #A1887F;">
                            <span>{postDetail.author}</span>
                            <span>{new Date(postDetail.datetime).toLocaleDateString('ko-KR')}</span>
                            <span>조회 {postDetail.views}</span>
                        </div>
                    </div>
                    {#if postDetail.link1 && extractYouTubeId(postDetail.link1)}
                        <div class="relative" style="padding-bottom: 56.25%;">
                            <iframe src="https://www.youtube.com/embed/{extractYouTubeId(postDetail.link1)}" title={postDetail.title}
                                class="absolute inset-0 h-full w-full" frameborder="0" allowfullscreen></iframe>
                        </div>
                    {/if}
                    <div class="prose prose-sm max-w-none p-6">{@html postDetail.content}</div>
                </div>

                {#if postComments.length > 0}
                    <div class="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm" style="border: 1px solid #E0D0C0;">
                        <div class="border-b p-4" style="border-color: #E0D0C0;">
                            <h3 class="font-serif font-bold" style="color: #5D4037;">댓글 ({postComments.length})</h3>
                        </div>
                        <div class="divide-y" style="border-color: #E0D0C0;">
                            {#each postComments as c}
                                <div class="p-4">
                                    <div class="mb-1 flex items-center gap-2 text-xs" style="color: #A1887F;">
                                        <span class="font-medium" style="color: #5D4037;">{c.author}</span>
                                        <span>{new Date(c.datetime).toLocaleDateString('ko-KR')}</span>
                                    </div>
                                    <div class="text-sm" style="color: #3E2723;">{@html c.content}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/if}
        </main>
    {:else if currentBoard === 'youtube'}
        <!-- YouTube 게시판 -->
        <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
            <h1 class="mb-6 font-serif text-2xl font-bold" style="color: #5D4037;">예배 영상</h1>
            <div class="space-y-6">
                {#each youtubeList as v}
                    {#if extractYouTubeId(v.link)}
                        <div class="overflow-hidden rounded-2xl bg-white shadow-sm" style="border: 1px solid #E0D0C0;">
                            <div class="relative" style="padding-bottom: 56.25%;">
                                <iframe src="https://www.youtube.com/embed/{extractYouTubeId(v.link)}" title={v.title}
                                    class="absolute inset-0 h-full w-full" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <div class="p-4">
                                <h3 class="font-serif font-bold" style="color: #5D4037;">{v.title}</h3>
                                <p class="text-sm" style="color: #A1887F;">{new Date(v.datetime).toLocaleDateString('ko-KR')}</p>
                            </div>
                        </div>
                    {/if}
                {:else}
                    {#if boardLoading}<p class="text-center" style="color: #A1887F;">로딩 중...</p>{/if}
                {/each}
            </div>
        </main>
    {:else if currentBoard === 'gallery'}
        <!-- 갤러리 (그리드) -->
        <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <h1 class="mb-6 font-serif text-2xl font-bold" style="color: #5D4037;">갤러리</h1>
            {#if boardLoading}
                <p class="text-center" style="color: #A1887F;">로딩 중...</p>
            {:else}
                <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {#each boardPosts as p}
                        <a href="/gallery/{p.id}" class="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md" style="border: 1px solid #E0D0C0;">
                            {#if p.image}
                                <img src={p.image} alt={p.title} class="h-48 w-full object-cover transition-transform group-hover:scale-105" />
                            {:else}
                                <div class="flex h-48 items-center justify-center bg-[#F5EDE3] text-3xl">📷</div>
                            {/if}
                            <div class="p-3">
                                <h3 class="text-sm font-medium line-clamp-1" style="color: #5D4037;">{p.title}</h3>
                                <p class="text-xs" style="color: #A1887F;">{new Date(p.datetime).toLocaleDateString('ko-KR')}</p>
                            </div>
                        </a>
                    {:else}
                        <div class="col-span-3 p-8 text-center" style="color: #A1887F;">사진이 없습니다</div>
                    {/each}
                </div>
            {/if}
        </main>
    {:else if currentBoard}
        <!-- 일반 게시판 -->
        <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
            <h1 class="mb-6 font-serif text-2xl font-bold" style="color: #5D4037;">{navItems.find(n => n.href === '/' + currentBoard)?.label || currentBoard}</h1>
            {#if boardLoading}
                <p class="text-center" style="color: #A1887F;">로딩 중...</p>
            {:else}
                <div class="overflow-hidden rounded-2xl bg-white shadow-sm" style="border: 1px solid #E0D0C0;">
                    <div class="divide-y" style="border-color: #E0D0C0;">
                        {#each boardPosts as p}
                            <a href="/{currentBoard}/{p.id}" class="flex items-center justify-between p-4 transition hover:bg-[#FFF8F0]">
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-sm font-medium line-clamp-1" style="color: #3E2723;">{p.title}</h3>
                                    <p class="text-xs" style="color: #A1887F;">{p.author} · {new Date(p.datetime).toLocaleDateString('ko-KR')}</p>
                                </div>
                            </a>
                        {:else}
                            <div class="p-8 text-center" style="color: #A1887F;">게시글이 없습니다</div>
                        {/each}
                    </div>
                </div>
            {/if}
        </main>
    {:else}
        <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
            {@render children()}
        </main>
    {/if}

    <!-- Footer -->
    <footer class="py-10 text-white" style="background: #5D4037;">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <img src="https://hdbc.kr/theme/NB-Basic/img/logo.png" alt="흥덕침례교회" class="h-8" />
                        <span class="font-serif text-lg font-bold">흥덕침례교회</span>
                    </div>
                    <p class="text-sm opacity-70">Heungdeok Baptist Church</p>
                    <p class="text-sm opacity-70">함께하는 은혜, 나누는 사랑</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm opacity-70">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm opacity-70">
                        <p>📍 충청북도 청주시 흥덕구</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs opacity-40">
                Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a>
            </div>
        </div>
    </footer>
</div>
