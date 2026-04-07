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
    <title>평화의 바다 — 잔잔한 은혜의 물결</title>
    <meta name="description" content="평화의 바다 교회에 오신 것을 환영합니다. 하나님의 평안 가운데 쉼을 얻는 공동체입니다." />
</svelte:head>

<div class="flex min-h-screen flex-col bg-[#F0F9FF]">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-[#0284C7]/15 bg-[#F0F9FF]/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0C4A6E] to-[#0284C7] shadow-md shadow-sky-200">
                    <span class="text-lg text-white">🌊</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-[#0C4A6E]">평화의 바다</span>
                    <p class="text-[10px] tracking-wider text-[#0284C7]">OCEAN OF PEACE</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-lg px-3 py-2 text-sm font-medium text-[#0C4A6E]/70 transition-colors hover:bg-[#0284C7]/10 hover:text-[#0C4A6E] {$page.url.pathname === item.href ? 'bg-[#0284C7]/15 font-bold text-[#0C4A6E]' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-lg bg-gradient-to-r from-[#0C4A6E] to-[#0284C7] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-lg sm:block">로그인</a>
                <button class="rounded-lg p-2 text-[#0C4A6E] hover:bg-[#0284C7]/10 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-[#0284C7]/15 bg-[#F0F9FF] px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-[#0C4A6E]/70 hover:bg-[#0284C7]/10" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block rounded-lg bg-gradient-to-r from-[#0C4A6E] to-[#0284C7] px-3 py-2 text-center text-sm font-medium text-white">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden py-32 text-white" style="background: linear-gradient(180deg, #0C4A6E 0%, #0284C7 50%, #38BDF8 100%);">
            <div class="absolute bottom-0 left-0 right-0 h-24 opacity-20">
                <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" class="h-full w-full">
                    <path d="M0 60C240 20 480 100 720 60C960 20 1200 100 1440 60V120H0V60Z" fill="white"/>
                </svg>
            </div>
            <div class="absolute top-0 left-0 right-0 h-24 opacity-10">
                <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" class="h-full w-full">
                    <path d="M0 80C360 40 720 100 1080 60C1260 40 1350 50 1440 80V0H0V80Z" fill="white"/>
                </svg>
            </div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 inline-block rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-1 text-sm text-sky-200">
                    🌊 잔잔한 은혜의 물결
                </div>
                <h1 class="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                    평화의 바다로<br/>여러분을 초대합니다
                </h1>
                <p class="mx-auto mb-10 max-w-xl text-lg text-sky-100">하나님의 평안 속에서 쉼을 얻고, 은혜의 물결 위에서 함께 나아갑니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-white px-8 py-4 font-bold text-[#0C4A6E] shadow-lg transition hover:shadow-xl">이번 주 설교 보기</a>
                    <a href="/about" class="rounded-full border-2 border-white/30 px-8 py-4 font-medium text-white backdrop-blur transition hover:bg-white/10">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- Bible Verse -->
        <section class="border-b border-[#0284C7]/15 bg-gradient-to-r from-[#0C4A6E]/5 via-[#0284C7]/8 to-[#38BDF8]/5 py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <div class="mb-3 text-2xl text-[#0284C7]">~</div>
                <blockquote class="text-lg italic text-[#0C4A6E] sm:text-xl">
                    "큰 물의 소리와 바다의 도도한 파도보다<br/>높으신 곳에 계신 여호와가 더 위엄이 있으시도다"
                </blockquote>
                <p class="mt-3 text-sm text-[#0284C7]">— 시편 93:4</p>
            </div>
        </section>

        <!-- Service Times -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#0C4A6E]">예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['🙏', '주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 묵상과 기도의 시간'],
                        ['🌙', '금요기도', '금요일 오후 8:00', '성령 충만의 기도 모임'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-2xl border border-[#0284C7]/15 bg-white p-6 text-center shadow-sm transition hover:shadow-lg hover:shadow-sky-100">
                            <div class="mb-3 text-4xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-[#0C4A6E]">{title}</h3>
                            <p class="mb-2 text-sm font-semibold text-[#0284C7]">{time}</p>
                            <p class="text-xs text-[#38BDF8]">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Latest Sermon -->
        <section class="border-y border-[#0284C7]/15 bg-gradient-to-br from-[#0C4A6E]/5 to-[#38BDF8]/5 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#0C4A6E]">이번 주 설교</h2>
                <div class="overflow-hidden rounded-2xl border border-[#0284C7]/15 bg-white shadow-lg shadow-sky-100">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-[#0C4A6E]/10 to-[#38BDF8]/10">
                        <div class="text-center">
                            <div class="mb-3 text-5xl">🎬</div>
                            <p class="text-sm text-[#0284C7]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="mt-3 inline-block rounded-lg bg-gradient-to-r from-[#0C4A6E] to-[#0284C7] px-4 py-2 text-sm font-medium text-white hover:shadow-lg">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Church News -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#0C4A6E]">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group rounded-2xl border border-[#0284C7]/15 bg-white p-6 shadow-sm transition hover:shadow-lg hover:shadow-sky-100">
                            <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0C4A6E] to-[#0284C7] text-xl text-white">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-[#0C4A6E] group-hover:text-[#0284C7]">{title}</h3>
                            <p class="text-sm text-[#0284C7]/70">{desc}</p>
                            <span class="mt-3 inline-block text-sm font-medium text-[#38BDF8]">바로가기 →</span>
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
    <footer class="border-t border-[#0284C7]/15 py-10 text-white" style="background: linear-gradient(135deg, #0C4A6E, #0284C7);">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl">🌊</span>
                        <span class="text-lg font-bold">평화의 바다</span>
                    </div>
                    <p class="text-sm text-sky-200">하나님의 평안 속에서 쉼을 얻는 공동체</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm text-sky-200">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm text-sky-200">
                        <p>서울특별시 OO구 OO로 123</p>
                        <p>02-1234-5678</p>
                        <p>ocean@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs text-sky-300">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
