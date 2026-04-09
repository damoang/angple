<script lang="ts">
    import type { Snippet } from 'svelte';
    import { page } from '$app/stores';

    interface Props { children: Snippet; }
    const { children }: Props = $props();
    const isHomePage = $derived($page.url.pathname === '/');

    const navItems = [
        { label: '홈', href: '/' },
        { label: '설교', href: '/sermon' },
        { label: '교회소개', href: '/about' },
        { label: '공지사항', href: '/notice' },
        { label: '기도제목', href: '/prayer' },
        { label: '오시는 길', href: '/location' },
    ];

    let mobileMenuOpen = $state(false);
</script>

<svelte:head>
    <title>빛의 교회 — 빛으로 인도하는 교회</title>
    <meta name="description" content="밝고 따뜻한 골드톤의 교회. 세상의 빛이 되는 공동체입니다." />
</svelte:head>

<div class="flex min-h-screen flex-col bg-white">
    <!-- Header: 화이트 + 골드 악센트 -->
    <header class="sticky top-0 z-50 border-b border-amber-100 bg-white/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 shadow-sm">
                    <span class="text-lg">☀️</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-amber-900">빛의 교회</span>
                    <p class="text-[10px] text-amber-500">Light Church</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-full px-4 py-2 text-sm font-medium text-amber-800/70 transition hover:bg-amber-50 hover:text-amber-900 {$page.url.pathname === item.href ? 'bg-amber-50 font-bold text-amber-900' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:shadow-md sm:block">로그인</a>
                <button class="rounded-full p-2 text-amber-700 hover:bg-amber-50 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-amber-100 bg-white px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-amber-800 hover:bg-amber-50" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero: 밝은 골드 그래디언트 -->
        <section class="relative overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 py-28">
            <!-- 빛 효과 -->
            <div class="absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl"></div>
            <div class="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-yellow-200/20 blur-3xl"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5">
                    <span class="text-sm">✨</span>
                    <span class="text-xs font-medium text-amber-700">Welcome to Light Church</span>
                </div>
                <h1 class="mb-6 text-4xl font-bold leading-tight text-amber-950 sm:text-5xl lg:text-6xl">
                    세상의 <span class="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">빛</span>
                </h1>
                <p class="mx-auto mb-10 max-w-xl text-lg text-amber-800/70">빛으로 인도하는 교회, 사랑으로 세상을 밝히는 공동체</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-bold text-white shadow-lg transition hover:shadow-xl">이번 주 설교 ☀️</a>
                    <a href="/about" class="rounded-full border-2 border-amber-300 px-8 py-4 font-medium text-amber-800 transition hover:bg-amber-50">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- 말씀 배너 -->
        <section class="border-y border-amber-100 bg-gradient-to-r from-amber-500 to-orange-500 py-8 text-white">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <blockquote class="text-lg font-medium italic sm:text-xl">
                    "너희는 세상의 빛이라 산 위에 있는 동네가 숨겨지지 못할 것이요"
                </blockquote>
                <p class="mt-3 text-sm opacity-80">— 마태복음 5:14</p>
            </div>
        </section>

        <!-- 예배 안내 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <div class="mb-10 text-center">
                    <span class="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">예배 안내</span>
                    <h2 class="mt-3 text-3xl font-bold text-amber-950">함께 드리는 예배</h2>
                </div>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 05:30', 'from-amber-400 to-yellow-300'],
                        ['☀️', '주일예배', '주일 11:00', 'from-orange-400 to-amber-400'],
                        ['📖', '수요예배', '수요 19:30', 'from-yellow-400 to-amber-300'],
                        ['🌙', '금요기도', '금요 20:00', 'from-amber-500 to-orange-400'],
                    ] as [icon, title, time, grad]}
                        <div class="group overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:shadow-md">
                            <div class="flex h-3 bg-gradient-to-r {grad}"></div>
                            <div class="p-6 text-center">
                                <div class="mb-3 text-4xl">{icon}</div>
                                <h3 class="mb-1 text-lg font-bold text-amber-900">{title}</h3>
                                <p class="text-sm text-amber-600">{time}</p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 이번 주 설교 -->
        <section class="bg-amber-50/50 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <div class="mb-10 text-center">
                    <span class="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Latest Sermon</span>
                    <h2 class="mt-3 text-3xl font-bold text-amber-950">이번 주 설교</h2>
                </div>
                <div class="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                        <div class="text-center">
                            <div class="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-3xl text-white shadow-lg">▶</div>
                            <p class="mt-4 text-sm text-amber-600">설교 영상이 여기에 표시됩니다</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 교회 소식 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <div class="mb-10 text-center">
                    <h2 class="text-3xl font-bold text-amber-950">교회 소식</h2>
                </div>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice', 'from-amber-400 to-yellow-300'],
                        ['🙏', '기도 제목', '함께 기도의 손을 모아주세요', '/prayer', 'from-orange-400 to-amber-400'],
                        ['📅', '교회 일정', '이번 달 행사와 모임', '/calendar', 'from-yellow-400 to-amber-300'],
                    ] as [icon, title, desc, href, grad]}
                        <a {href} class="group overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:shadow-md">
                            <div class="flex h-2 bg-gradient-to-r {grad}"></div>
                            <div class="p-6">
                                <div class="mb-3 text-3xl">{icon}</div>
                                <h3 class="mb-2 text-lg font-bold text-amber-900 group-hover:text-orange-600">{title}</h3>
                                <p class="text-sm text-amber-700/60">{desc}</p>
                                <span class="mt-4 inline-block text-sm font-medium text-amber-500">자세히 보기 →</span>
                            </div>
                        </a>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 오시는 길 -->
        <section class="border-t border-amber-100 bg-amber-50/50 py-16">
            <div class="mx-auto max-w-4xl px-4 text-center">
                <h2 class="mb-6 text-3xl font-bold text-amber-950">오시는 길</h2>
                <p class="mb-2 text-amber-800">📍 서울특별시 OO구 OO로 789</p>
                <p class="mb-6 text-sm text-amber-600">📞 02-5678-1234 | ✉️ light@church.re.kr</p>
                <div class="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm" style="height: 280px;">
                    <div class="flex h-full items-center justify-center text-amber-400">
                        <div class="text-center">
                            <div class="mb-2 text-4xl">🗺️</div>
                            <p class="text-sm">지도가 여기에 표시됩니다</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    {:else}
        <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
            {@render children()}
        </main>
    {/if}

    <!-- Footer -->
    <footer class="bg-gradient-to-r from-amber-500 to-orange-500 py-10 text-white">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl">☀️</span>
                        <span class="text-lg font-bold">빛의 교회</span>
                    </div>
                    <p class="text-sm opacity-80">빛으로 인도하는 교회</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm opacity-80">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm opacity-80">
                        <p>📍 서울특별시 OO구 OO로 789</p>
                        <p>📞 02-5678-1234</p>
                        <p>✉️ light@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/30 pt-6 text-center text-xs opacity-60">
                Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a>
            </div>
        </div>
    </footer>
</div>
