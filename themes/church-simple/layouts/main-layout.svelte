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
    <title>말씀 중심 — 단순함 속에 깊은 진리</title>
    <meta name="description" content="말씀 중심 교회에 오신 것을 환영합니다. 여호와를 경외하는 것이 지혜의 근본입니다." />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    </style>
</svelte:head>

<div class="flex min-h-screen flex-col bg-white" style="font-family: 'Noto Sans KR', sans-serif;">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
        <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-2">
                <span class="text-lg font-bold text-[#334155]">말씀 중심</span>
            </a>
            <nav class="hidden items-center gap-6 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="text-sm text-[#64748B] transition-colors hover:text-[#334155] {$page.url.pathname === item.href ? 'font-bold text-[#334155]' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden border border-[#334155] px-4 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#334155] hover:text-white sm:block">로그인</a>
                <button class="p-2 text-[#334155] lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-[#E2E8F0] bg-white px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block px-3 py-2 text-sm text-[#64748B] hover:text-[#334155]" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block border border-[#334155] px-3 py-2 text-center text-sm font-medium text-[#334155]">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="py-32" style="background: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%);">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <h1 class="mb-8 text-4xl font-bold leading-tight text-[#334155] sm:text-5xl lg:text-6xl" style="letter-spacing: -0.02em;">
                    말씀 중심
                </h1>
                <p class="mx-auto mb-12 max-w-md text-lg font-light leading-relaxed text-[#64748B]">단순함 속에 깊은 진리,<br/>말씀 위에 세워진 공동체입니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="bg-[#334155] px-8 py-3 text-sm font-medium text-white transition hover:bg-[#1E293B]">이번 주 설교 보기</a>
                    <a href="/about" class="border border-[#94A3B8] px-8 py-3 text-sm font-medium text-[#64748B] transition hover:border-[#334155] hover:text-[#334155]">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- Bible Verse -->
        <section class="border-y border-[#E2E8F0] py-12">
            <div class="mx-auto max-w-2xl px-4 text-center">
                <blockquote class="text-xl font-light leading-relaxed text-[#334155]" style="letter-spacing: 0.01em;">
                    "여호와를 경외하는 것이 지혜의 근본이요"
                </blockquote>
                <p class="mt-4 text-xs font-medium uppercase tracking-widest text-[#94A3B8]">잠언 9:10</p>
            </div>
        </section>

        <!-- Service Times -->
        <section class="py-20">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-12 text-center text-2xl font-bold text-[#334155]">예배 안내</h2>
                <div class="grid grid-cols-1 gap-px bg-[#E2E8F0] sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['수요예배', '수요일 오후 7:30', '말씀 묵상과 기도의 시간'],
                        ['금요기도', '금요일 오후 8:00', '성령 충만의 기도 모임'],
                    ] as [title, time, desc]}
                        <div class="bg-white p-8 text-center">
                            <h3 class="mb-2 text-sm font-bold uppercase tracking-wider text-[#334155]">{title}</h3>
                            <p class="mb-3 text-lg font-light text-[#64748B]">{time}</p>
                            <p class="text-xs text-[#94A3B8]">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Latest Sermon -->
        <section class="border-y border-[#E2E8F0] bg-[#F8FAFC] py-20">
            <div class="mx-auto max-w-3xl px-4">
                <h2 class="mb-12 text-center text-2xl font-bold text-[#334155]">이번 주 설교</h2>
                <div class="overflow-hidden border border-[#E2E8F0] bg-white">
                    <div class="flex aspect-video items-center justify-center bg-[#F1F5F9]">
                        <div class="text-center">
                            <p class="mb-3 text-sm text-[#94A3B8]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="inline-block bg-[#334155] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Church News -->
        <section class="py-20">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-12 text-center text-2xl font-bold text-[#334155]">교회 소식</h2>
                <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {#each [
                        ['공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['기도 제목', '함께 기도해주세요', '/prayer'],
                        ['교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [title, desc, href]}
                        <a {href} class="group border-t-2 border-[#E2E8F0] pt-6 transition hover:border-[#334155]">
                            <h3 class="mb-2 text-sm font-bold uppercase tracking-wider text-[#334155]">{title}</h3>
                            <p class="text-sm font-light text-[#94A3B8]">{desc}</p>
                            <span class="mt-4 inline-block text-xs font-medium text-[#64748B] group-hover:text-[#334155]">바로가기 →</span>
                        </a>
                    {/each}
                </div>
            </div>
        </section>
    {:else}
        <main class="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
            {@render children()}
        </main>
    {/if}

    <!-- Footer -->
    <footer class="border-t border-[#E2E8F0] bg-[#334155] py-10 text-white">
        <div class="mx-auto max-w-5xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <span class="text-lg font-bold">말씀 중심</span>
                    <p class="mt-2 text-sm font-light text-[#94A3B8]">단순함 속에 깊은 진리</p>
                </div>
                <div>
                    <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">예배 시간</h4>
                    <div class="space-y-1 text-sm font-light text-[#CBD5E1]">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">연락처</h4>
                    <div class="space-y-1 text-sm font-light text-[#CBD5E1]">
                        <p>서울특별시 OO구 OO로 123</p>
                        <p>02-1234-5678</p>
                        <p>simple@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/10 pt-6 text-center text-xs text-[#64748B]">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
