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
    <title>자연의 교회 — 자연 속에서 만나는 하나님</title>
    <meta name="description" content="녹색 자연 친화적 교회. 창조주의 아름다운 세계에서 은혜를 경험합니다." />
</svelte:head>

<div class="flex min-h-screen flex-col bg-[#F0FDF4]">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400">
                    <span class="text-lg text-white">🌿</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-emerald-800">자연의 교회</span>
                    <p class="text-[10px] text-emerald-500">Nature Church</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-lg px-3 py-2 text-sm font-medium text-emerald-700/70 transition hover:bg-emerald-50 hover:text-emerald-800 {$page.url.pathname === item.href ? 'bg-emerald-50 font-bold text-emerald-800' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 sm:block">로그인</a>
                <button class="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-emerald-100 bg-white px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero: 숲속 느낌 -->
        <section class="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 py-32 text-white">
            <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#F0FDF4] to-transparent"></div>
            <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%222%22 fill=%22white%22/%3E%3Ccircle cx=%2220%22 cy=%2280%22 r=%221%22 fill=%22white%22/%3E%3Ccircle cx=%2280%22 cy=%2220%22 r=%221.5%22 fill=%22white%22/%3E%3C/svg%3E');"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 text-6xl">🌳</div>
                <h1 class="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                    자연 속에서<br/>만나는 하나님
                </h1>
                <p class="mx-auto mb-10 max-w-xl text-lg opacity-90">창조의 아름다움 가운데 은혜를 경험하는 공동체</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-white px-8 py-4 font-bold text-emerald-700 shadow-lg transition hover:shadow-xl">설교 듣기 🌿</a>
                    <a href="/about" class="rounded-full border-2 border-white/30 px-8 py-4 font-medium backdrop-blur transition hover:bg-white/10">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- 말씀 -->
        <section class="py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <div class="rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
                    <div class="mb-3 text-3xl">🍃</div>
                    <blockquote class="text-lg italic text-emerald-800">
                        "여호와를 기뻐하라 그가 네 마음의 소원을 네게 이루어 주시리로다"
                    </blockquote>
                    <p class="mt-3 text-sm text-emerald-500">— 시편 37:4</p>
                </div>
            </div>
        </section>

        <!-- 예배 안내 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-emerald-900">🌱 예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 05:30', '새벽 이슬처럼 기도합니다'],
                        ['🌿', '주일예배', '주일 11:00', '온 가족이 함께하는 예배'],
                        ['🌾', '수요예배', '수요 19:30', '말씀으로 자라나는 시간'],
                        ['🌙', '금요기도', '금요 20:00', '깊은 기도의 밤'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-emerald-200">
                            <div class="mb-3 text-4xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-emerald-800">{title}</h3>
                            <p class="mb-2 text-sm font-semibold text-emerald-500">{time}</p>
                            <p class="text-xs text-emerald-600/60">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 설교 -->
        <section class="bg-emerald-50 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-emerald-900">🎬 이번 주 설교</h2>
                <div class="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
                        <div class="text-center">
                            <div class="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white shadow-lg">▶</div>
                            <p class="mt-4 text-sm text-emerald-600">설교 영상</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 소식 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-emerald-900">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition hover:shadow-md">
                            <div class="mb-3 text-3xl">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-emerald-800 group-hover:text-emerald-600">{title}</h3>
                            <p class="text-sm text-emerald-600/60">{desc}</p>
                        </a>
                    {/each}
                </div>
            </div>
        </section>
    {:else}
        <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
            {@render children()}
        </main>
    {/if}

    <!-- Footer -->
    <footer class="border-t border-emerald-100 bg-emerald-800 py-10 text-white">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2"><span class="text-xl">🌿</span><span class="text-lg font-bold">자연의 교회</span></div>
                    <p class="text-sm opacity-70">자연 속에서 만나는 하나님</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm opacity-70"><p>주일 11:00 | 수요 19:30 | 새벽 05:30</p></div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm opacity-70"><p>📍 서울시 OO구 | 📞 02-1111-2222</p></div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs opacity-50">Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></div>
        </div>
    </footer>
</div>
