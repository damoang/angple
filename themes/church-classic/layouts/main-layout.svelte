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
    <title>전통과 믿음 — 세대를 이어가는 신앙의 유산</title>
    <meta name="description" content="전통과 믿음의 교회에 오신 것을 환영합니다. 예수 그리스도는 어제나 오늘이나 영원토록 동일하시니라." />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&display=swap');
    </style>
</svelte:head>

<div class="flex min-h-screen flex-col" style="font-family: 'Noto Serif KR', Georgia, serif; background: #FEF2F2;">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b-2 border-[#991B1B]/20 bg-[#FEF2F2]/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-none border-2 border-[#991B1B] bg-[#991B1B]">
                    <span class="text-lg font-bold text-white">✝</span>
                </div>
                <div>
                    <span class="text-lg font-bold text-[#991B1B]">전통과 믿음</span>
                    <p class="text-[10px] tracking-[0.2em] text-[#B91C1C]">HERITAGE OF FAITH</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="border-b-2 px-3 py-2 text-sm font-medium text-[#991B1B]/70 transition-colors hover:border-[#991B1B] hover:text-[#991B1B] {$page.url.pathname === item.href ? 'border-[#991B1B] font-bold text-[#991B1B]' : 'border-transparent'}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden border-2 border-[#991B1B] bg-[#991B1B] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7F1D1D] sm:block">로그인</a>
                <button class="p-2 text-[#991B1B] hover:bg-[#991B1B]/10 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t-2 border-[#991B1B]/20 bg-[#FEF2F2] px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block px-3 py-2 text-sm text-[#991B1B]/70 hover:bg-[#991B1B]/10 hover:text-[#991B1B]" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block border-2 border-[#991B1B] bg-[#991B1B] px-3 py-2 text-center text-sm font-medium text-white">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden py-32 text-white" style="background: linear-gradient(160deg, #7F1D1D 0%, #991B1B 30%, #B91C1C 70%, #991B1B 100%);">
            <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Cpath d=%22M30 5v20M30 35v20M5 30h20M35 30h20%22 stroke=%22%23FFD700%22 stroke-width=%220.5%22 fill=%22none%22/%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2210%22 stroke=%22%23FFD700%22 stroke-width=%220.3%22 fill=%22none%22/%3E%3C/svg%3E');"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 text-sm uppercase tracking-[0.3em] text-red-200">Since 1950 · Heritage of Faith</div>
                <h1 class="mb-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl" style="letter-spacing: 0.05em;">
                    전통과 믿음의<br/>거룩한 전당
                </h1>
                <div class="mx-auto mb-8 h-px w-24 bg-yellow-400/50"></div>
                <p class="mx-auto mb-10 max-w-xl text-lg text-red-100">변하지 않는 진리 위에 세워진 교회, 세대를 넘어 신앙의 유산을 이어갑니다</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="border-2 border-white bg-white px-8 py-4 font-bold text-[#991B1B] transition hover:bg-transparent hover:text-white">이번 주 설교 보기</a>
                    <a href="/about" class="border-2 border-white/40 px-8 py-4 font-medium text-white transition hover:border-white hover:bg-white/10">교회 소개</a>
                </div>
            </div>
        </section>

        <!-- Bible Verse -->
        <section class="border-b-2 border-[#991B1B]/15 bg-[#991B1B]/5 py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <div class="mx-auto mb-4 h-px w-16 bg-[#991B1B]/30"></div>
                <blockquote class="text-lg italic text-[#991B1B] sm:text-xl" style="letter-spacing: 0.02em;">
                    "예수 그리스도는 어제나 오늘이나<br/>영원토록 동일하시니라"
                </blockquote>
                <p class="mt-3 text-sm text-[#B91C1C]">— 히브리서 13:8</p>
                <div class="mx-auto mt-4 h-px w-16 bg-[#991B1B]/30"></div>
            </div>
        </section>

        <!-- Service Times -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#991B1B]">예배 안내</h2>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작합니다'],
                        ['🙏', '주일예배', '주일 오전 11:00', '온 성도가 함께 드리는 예배'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 묵상과 기도의 시간'],
                        ['🌙', '금요기도', '금요일 오후 8:00', '성령 충만의 기도 모임'],
                    ] as [icon, title, time, desc]}
                        <div class="border-2 border-[#991B1B]/15 bg-white p-6 text-center transition hover:border-[#991B1B]/30 hover:shadow-md">
                            <div class="mb-3 text-4xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-[#991B1B]">{title}</h3>
                            <p class="mb-2 text-sm font-semibold text-[#DC2626]">{time}</p>
                            <p class="text-xs text-[#B91C1C]/70">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Latest Sermon -->
        <section class="border-y-2 border-[#991B1B]/15 bg-[#991B1B]/5 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#991B1B]">이번 주 설교</h2>
                <div class="overflow-hidden border-2 border-[#991B1B]/20 bg-white shadow-md">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-[#991B1B]/10 to-[#B91C1C]/5">
                        <div class="text-center">
                            <div class="mb-3 text-5xl">🎬</div>
                            <p class="text-sm text-[#B91C1C]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="mt-3 inline-block border-2 border-[#991B1B] bg-[#991B1B] px-4 py-2 text-sm font-medium text-white hover:bg-[#7F1D1D]">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Church News -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-10 text-center text-3xl font-bold text-[#991B1B]">교회 소식</h2>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group border-2 border-[#991B1B]/15 bg-white p-6 transition hover:border-[#991B1B]/30 hover:shadow-md">
                            <div class="mb-3 text-3xl">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-[#991B1B] group-hover:text-[#DC2626]">{title}</h3>
                            <p class="text-sm text-[#B91C1C]/70">{desc}</p>
                            <div class="mt-4 h-px w-full bg-[#991B1B]/10"></div>
                            <span class="mt-3 inline-block text-sm font-medium text-[#DC2626]">바로가기 →</span>
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
    <footer class="border-t-2 border-[#991B1B]/20 bg-[#7F1D1D] py-10 text-white">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl font-bold">✝</span>
                        <span class="text-lg font-bold">전통과 믿음</span>
                    </div>
                    <p class="text-sm text-red-200">세대를 이어가는 신앙의 유산</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm text-red-200">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm text-red-200">
                        <p>서울특별시 OO구 OO로 123</p>
                        <p>02-1234-5678</p>
                        <p>classic@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs text-red-300">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
