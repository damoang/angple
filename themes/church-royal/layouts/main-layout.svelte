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
    <title>거룩한 성전 — 여호와의 영광이 충만한 곳</title>
    <meta name="description" content="거룩한 성전에 오신 것을 환영합니다. 하나님의 권능과 영광 가운데 함께 예배합니다." />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&display=swap');
    </style>
</svelte:head>

<div class="flex min-h-screen flex-col" style="font-family: 'Noto Serif KR', serif; background: #FAF5FF;">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-[#7C3AED]/20 bg-[#FAF5FF]/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] shadow-lg shadow-purple-300">
                    <span class="text-lg text-yellow-300">👑</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-[#4C1D95]">거룩한 성전</span>
                    <p class="text-[10px] tracking-wider text-[#7C3AED]">HOLY TEMPLE</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-lg px-3 py-2 text-sm font-medium text-[#4C1D95]/70 transition-colors hover:bg-[#7C3AED]/10 hover:text-[#4C1D95] {$page.url.pathname === item.href ? 'bg-[#7C3AED]/15 font-bold text-[#4C1D95]' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-lg bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-lg sm:block">로그인</a>
                <button class="rounded-lg p-2 text-[#4C1D95] hover:bg-[#7C3AED]/10 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-[#7C3AED]/20 bg-[#FAF5FF] px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-[#4C1D95]/70 hover:bg-[#7C3AED]/10" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block rounded-lg bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] px-3 py-2 text-center text-sm font-medium text-white">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden py-32 text-white" style="background: linear-gradient(135deg, #4C1D95 0%, #7C3AED 40%, #A78BFA 100%);">
            <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22%3E%3Cpath d=%22M50 5L55 20H70L58 30L63 45L50 35L37 45L42 30L30 20H45Z%22 fill=%22%23FFD700%22/%3E%3C/svg%3E');"></div>
            <div class="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 inline-block rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1 text-sm text-yellow-300">
                    👑 하나님의 영광이 충만한 곳
                </div>
                <h1 class="mb-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                    거룩한 성전에<br/>오신 것을 환영합니다
                </h1>
                <p class="mx-auto mb-10 max-w-xl text-lg text-purple-100">만왕의 왕이신 하나님께 영광을 올려드리며, 거룩한 예배로 나아갑니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-yellow-400 px-8 py-4 font-bold text-[#4C1D95] shadow-lg transition hover:bg-yellow-300 hover:shadow-xl">이번 주 설교 보기</a>
                    <a href="/about" class="rounded-full border-2 border-white/30 px-8 py-4 font-medium text-white backdrop-blur transition hover:bg-white/10">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- Bible Verse -->
        <section class="border-b border-[#7C3AED]/20 bg-gradient-to-r from-[#4C1D95]/5 via-[#7C3AED]/10 to-[#A78BFA]/5 py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <div class="mb-3 text-2xl text-yellow-500">✦</div>
                <blockquote class="text-lg italic text-[#4C1D95] sm:text-xl">
                    "거룩하다 거룩하다 거룩하다 만군의 여호와여<br/>그의 영광이 온 땅에 충만하도다"
                </blockquote>
                <p class="mt-3 text-sm text-[#7C3AED]">— 이사야 6:3</p>
            </div>
        </section>

        <!-- Service Times -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#4C1D95]">예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['🙏', '주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 묵상과 기도의 시간'],
                        ['🌙', '금요기도', '금요일 오후 8:00', '성령 충만의 기도 모임'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-2xl border border-[#7C3AED]/20 bg-white p-6 text-center shadow-sm transition hover:shadow-lg hover:shadow-purple-200">
                            <div class="mb-3 text-4xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-[#4C1D95]">{title}</h3>
                            <p class="mb-2 text-sm font-semibold text-[#7C3AED]">{time}</p>
                            <p class="text-xs text-[#A78BFA]">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Latest Sermon -->
        <section class="border-y border-[#7C3AED]/20 bg-gradient-to-br from-[#4C1D95]/5 to-[#A78BFA]/5 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#4C1D95]">이번 주 설교</h2>
                <div class="overflow-hidden rounded-2xl border border-[#7C3AED]/20 bg-white shadow-lg shadow-purple-100">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-[#4C1D95]/10 to-[#7C3AED]/10">
                        <div class="text-center">
                            <div class="mb-3 text-5xl">🎬</div>
                            <p class="text-sm text-[#7C3AED]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="mt-3 inline-block rounded-lg bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] px-4 py-2 text-sm font-medium text-white hover:shadow-lg">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Church News -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#4C1D95]">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group rounded-2xl border border-[#7C3AED]/20 bg-white p-6 shadow-sm transition hover:shadow-lg hover:shadow-purple-100">
                            <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] text-xl text-white">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-[#4C1D95] group-hover:text-[#7C3AED]">{title}</h3>
                            <p class="text-sm text-[#7C3AED]/70">{desc}</p>
                            <span class="mt-3 inline-block text-sm font-medium text-[#A78BFA]">바로가기 →</span>
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
    <footer class="border-t border-[#7C3AED]/20 py-10 text-white" style="background: linear-gradient(135deg, #4C1D95, #7C3AED);">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl text-yellow-300">👑</span>
                        <span class="text-lg font-bold">거룩한 성전</span>
                    </div>
                    <p class="text-sm text-purple-200">만왕의 왕이신 하나님께 영광을 올려드립니다</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm text-purple-200">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm text-purple-200">
                        <p>서울특별시 OO구 OO로 123</p>
                        <p>02-1234-5678</p>
                        <p>royal@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs text-purple-300">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
