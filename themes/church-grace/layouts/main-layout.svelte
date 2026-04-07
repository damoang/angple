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
    <title>은혜의 교회 — 하나님의 사랑으로 하나되는 공동체</title>
    <meta name="description" content="은혜의 교회에 오신 것을 환영합니다. 따뜻한 사랑과 말씀으로 함께하는 공동체입니다." />
    <style>
        :root {
            --church-primary: #8B4513;
            --church-accent: #D4A574;
            --church-warm: #F5E6D3;
        }
    </style>
</svelte:head>

<div class="flex min-h-screen flex-col bg-[#FDFBF7]">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-[#E8D5C0] bg-[#FDFBF7]/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B4513] to-[#D4A574]">
                    <span class="text-lg text-white">✝</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-[#8B4513]">은혜의 교회</span>
                    <p class="text-[10px] text-[#A0856B]">Grace Church</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-lg px-3 py-2 text-sm font-medium text-[#6B4E37] transition-colors hover:bg-[#F0E0CC] {$page.url.pathname === item.href ? 'bg-[#F0E0CC] font-bold text-[#8B4513]' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-lg bg-[#8B4513] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B3410] sm:block">로그인</a>
                <button class="rounded-lg p-2 text-[#8B4513] hover:bg-[#F0E0CC] lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-[#E8D5C0] bg-[#FDFBF7] px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-[#6B4E37] hover:bg-[#F0E0CC]" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block rounded-lg bg-[#8B4513] px-3 py-2 text-center text-sm font-medium text-white">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden bg-gradient-to-br from-[#8B4513] via-[#A0673D] to-[#D4A574] py-28 text-white">
            <div class="absolute inset-0 opacity-5" style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Cpath d=%22M40 10v25M40 45v25M10 40h25M45 40h25%22 stroke=%22white%22 stroke-width=%221%22 fill=%22none%22/%3E%3C/svg%3E');"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <p class="mb-4 text-sm font-medium uppercase tracking-widest opacity-80">Welcome to Grace Church</p>
                <h1 class="mb-6 font-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">은혜가 넘치는 곳,<br/>사랑이 머무는 곳</h1>
                <p class="mx-auto mb-10 max-w-xl text-lg opacity-90">하나님의 은혜와 사랑 안에서 함께 성장하는 공동체입니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-white px-8 py-4 font-bold text-[#8B4513] shadow-lg transition hover:shadow-xl">이번 주 설교 보기</a>
                    <a href="/about" class="rounded-full border-2 border-white/40 px-8 py-4 font-medium backdrop-blur transition hover:bg-white/10">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- 말씀 카드 -->
        <section class="border-b border-[#E8D5C0] bg-[#F5E6D3] py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <blockquote class="font-serif text-lg italic text-[#6B4E37] sm:text-xl">
                    "여호와는 나의 목자시니 내게 부족함이 없으리로다"
                </blockquote>
                <p class="mt-3 text-sm text-[#A0856B]">— 시편 23:1</p>
            </div>
        </section>

        <!-- 예배 안내 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center font-serif text-3xl font-bold text-[#8B4513]">예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['🙏', '주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 묵상과 기도의 시간'],
                        ['🌙', '금요기도', '금요일 오후 8:00', '성령 충만의 기도 모임'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-2xl border border-[#E8D5C0] bg-white p-6 text-center shadow-sm transition hover:shadow-md">
                            <div class="mb-3 text-4xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-[#8B4513]">{title}</h3>
                            <p class="mb-2 text-sm font-semibold text-[#D4A574]">{time}</p>
                            <p class="text-xs text-[#A0856B]">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 이번 주 설교 -->
        <section class="border-y border-[#E8D5C0] bg-[#F5E6D3]/50 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-10 text-center font-serif text-3xl font-bold text-[#8B4513]">이번 주 설교</h2>
                <div class="overflow-hidden rounded-2xl border border-[#E8D5C0] bg-white shadow-sm">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-[#8B4513]/10 to-[#D4A574]/10">
                        <div class="text-center">
                            <div class="mb-3 text-5xl">🎬</div>
                            <p class="text-sm text-[#A0856B]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="mt-3 inline-block rounded-lg bg-[#8B4513] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B3410]">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 교회 소식 -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center font-serif text-3xl font-bold text-[#8B4513]">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group rounded-2xl border border-[#E8D5C0] bg-white p-6 shadow-sm transition hover:shadow-md">
                            <div class="mb-3 text-3xl">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-[#8B4513] group-hover:text-[#6B3410]">{title}</h3>
                            <p class="text-sm text-[#A0856B]">{desc}</p>
                            <span class="mt-3 inline-block text-sm font-medium text-[#D4A574]">바로가기 →</span>
                        </a>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 오시는 길 -->
        <section class="border-t border-[#E8D5C0] bg-[#F5E6D3]/50 py-16">
            <div class="mx-auto max-w-4xl px-4 text-center">
                <h2 class="mb-6 font-serif text-3xl font-bold text-[#8B4513]">오시는 길</h2>
                <p class="mb-2 text-[#6B4E37]">📍 서울특별시 OO구 OO로 123</p>
                <p class="mb-6 text-sm text-[#A0856B]">📞 02-1234-5678 | ✉️ grace@church.re.kr</p>
                <div class="overflow-hidden rounded-2xl border border-[#E8D5C0] bg-gray-100" style="height: 300px;">
                    <div class="flex h-full items-center justify-center text-[#A0856B]">
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
    <footer class="border-t border-[#E8D5C0] bg-[#8B4513] py-10 text-white">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl">✝</span>
                        <span class="text-lg font-bold">은혜의 교회</span>
                    </div>
                    <p class="text-sm opacity-70">하나님의 사랑으로 하나되는 공동체</p>
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
                        <p>📍 서울특별시 OO구 OO로 123</p>
                        <p>📞 02-1234-5678</p>
                        <p>✉️ grace@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs opacity-50">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
