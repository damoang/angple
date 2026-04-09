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
    <title>환영합니다 — 따뜻한 사랑으로 맞이하는 교회</title>
    <meta name="description" content="따뜻한 교회에 오신 것을 환영합니다. 수고하고 무거운 짐 진 자들아 다 내게로 오라." />
</svelte:head>

<div class="flex min-h-screen flex-col bg-[#FFF7ED]">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-[#EA580C]/15 bg-[#FFF7ED]/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9A3412] to-[#EA580C] shadow-md shadow-orange-200">
                    <span class="text-lg text-white">☀️</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-[#9A3412]">환영합니다</span>
                    <p class="text-[10px] tracking-wider text-[#EA580C]">WELCOME CHURCH</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-full px-4 py-2 text-sm font-medium text-[#9A3412]/70 transition-colors hover:bg-[#EA580C]/10 hover:text-[#9A3412] {$page.url.pathname === item.href ? 'bg-[#EA580C]/15 font-bold text-[#9A3412]' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-full bg-gradient-to-r from-[#9A3412] to-[#EA580C] px-5 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-lg sm:block">로그인</a>
                <button class="rounded-lg p-2 text-[#9A3412] hover:bg-[#EA580C]/10 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-[#EA580C]/15 bg-[#FFF7ED] px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-[#9A3412]/70 hover:bg-[#EA580C]/10" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block rounded-full bg-gradient-to-r from-[#9A3412] to-[#EA580C] px-3 py-2 text-center text-sm font-medium text-white">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden py-32 text-white" style="background: linear-gradient(135deg, #9A3412 0%, #EA580C 50%, #FB923C 100%);">
            <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px); background-size: 60px 60px;"></div>
            <div class="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl"></div>
            <div class="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 text-6xl">🤗</div>
                <h1 class="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                    환영합니다!<br/>이곳은 당신의 집입니다
                </h1>
                <p class="mx-auto mb-10 max-w-xl text-lg text-orange-100">어디서 왔든, 무엇을 하든, 당신은 이곳에서 사랑받습니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-white px-8 py-4 font-bold text-[#9A3412] shadow-lg transition hover:shadow-xl">이번 주 설교 보기</a>
                    <a href="/about" class="rounded-full border-2 border-white/30 px-8 py-4 font-medium text-white backdrop-blur transition hover:bg-white/10">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- Bible Verse -->
        <section class="border-b border-[#EA580C]/15 bg-gradient-to-r from-[#9A3412]/5 via-[#EA580C]/8 to-[#FB923C]/5 py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <div class="mb-3 text-2xl text-[#EA580C]">🕊️</div>
                <blockquote class="text-lg italic text-[#9A3412] sm:text-xl">
                    "수고하고 무거운 짐 진 자들아 다 내게로 오라<br/>내가 너희를 쉬게 하리라"
                </blockquote>
                <p class="mt-3 text-sm text-[#EA580C]">— 마태복음 11:28</p>
            </div>
        </section>

        <!-- Service Times -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#9A3412]">예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['🙏', '주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 묵상과 기도의 시간'],
                        ['🌙', '금요기도', '금요일 오후 8:00', '성령 충만의 기도 모임'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-3xl border border-[#EA580C]/15 bg-white p-6 text-center shadow-sm transition hover:shadow-lg hover:shadow-orange-100">
                            <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FB923C]/20 to-[#EA580C]/10 text-3xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-[#9A3412]">{title}</h3>
                            <p class="mb-2 text-sm font-semibold text-[#EA580C]">{time}</p>
                            <p class="text-xs text-[#FB923C]">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Latest Sermon -->
        <section class="border-y border-[#EA580C]/15 bg-gradient-to-br from-[#9A3412]/5 to-[#FB923C]/5 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#9A3412]">이번 주 설교</h2>
                <div class="overflow-hidden rounded-3xl border border-[#EA580C]/15 bg-white shadow-lg shadow-orange-100">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-[#9A3412]/10 to-[#FB923C]/10">
                        <div class="text-center">
                            <div class="mb-3 text-5xl">🎬</div>
                            <p class="text-sm text-[#EA580C]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="mt-3 inline-block rounded-full bg-gradient-to-r from-[#9A3412] to-[#EA580C] px-5 py-2 text-sm font-medium text-white hover:shadow-lg">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Church News -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#9A3412]">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group rounded-3xl border border-[#EA580C]/15 bg-white p-6 shadow-sm transition hover:shadow-lg hover:shadow-orange-100">
                            <div class="mb-3 text-3xl">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-[#9A3412] group-hover:text-[#EA580C]">{title}</h3>
                            <p class="text-sm text-[#EA580C]/70">{desc}</p>
                            <span class="mt-3 inline-block rounded-full bg-[#EA580C]/10 px-3 py-1 text-xs font-medium text-[#EA580C]">바로가기 →</span>
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
    <footer class="border-t border-[#EA580C]/15 py-10 text-white" style="background: linear-gradient(135deg, #9A3412, #EA580C);">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl">☀️</span>
                        <span class="text-lg font-bold">환영합니다</span>
                    </div>
                    <p class="text-sm text-orange-200">따뜻한 사랑으로 맞이하는 공동체</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm text-orange-200">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm text-orange-200">
                        <p>서울특별시 OO구 OO로 123</p>
                        <p>02-1234-5678</p>
                        <p>warm@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs text-orange-300">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
