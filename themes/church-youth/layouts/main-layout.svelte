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
    <title>함께하는 예배 — 청년이 이끄는 새로운 물결</title>
    <meta name="description" content="함께하는 예배에 오신 것을 환영합니다. 젊은 열정으로 하나님을 찬양합니다." />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;900&display=swap');
    </style>
</svelte:head>

<div class="flex min-h-screen flex-col" style="font-family: 'Pretendard', sans-serif; background: #FDF2F8;">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-[#EC4899]/20 bg-[#FDF2F8]/95 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#EC4899] to-[#A855F7] shadow-lg shadow-pink-200">
                    <span class="text-lg text-white">🎵</span>
                </div>
                <div>
                    <span class="text-lg font-bold bg-gradient-to-r from-[#EC4899] to-[#A855F7] bg-clip-text text-transparent">함께하는 예배</span>
                    <p class="text-[10px] tracking-wider text-[#EC4899]">WORSHIP TOGETHER</p>
                </div>
            </a>
            <nav class="hidden items-center gap-1 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="rounded-full px-4 py-2 text-sm font-semibold text-[#831843]/70 transition-all hover:bg-gradient-to-r hover:from-[#EC4899]/10 hover:to-[#A855F7]/10 hover:text-[#831843] {$page.url.pathname === item.href ? 'bg-gradient-to-r from-[#EC4899]/15 to-[#A855F7]/15 font-bold text-[#831843]' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded-full bg-gradient-to-r from-[#EC4899] to-[#A855F7] px-5 py-2 text-sm font-bold text-white shadow-lg shadow-pink-200 transition hover:shadow-xl sm:block">로그인</a>
                <button class="rounded-lg p-2 text-[#EC4899] hover:bg-[#EC4899]/10 lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-[#EC4899]/20 bg-[#FDF2F8] px-4 py-3 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block rounded-lg px-3 py-2 text-sm text-[#831843]/70 hover:bg-[#EC4899]/10" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
                <a href="/login" class="mt-2 block rounded-full bg-gradient-to-r from-[#EC4899] to-[#A855F7] px-3 py-2 text-center text-sm font-bold text-white">로그인</a>
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero -->
        <section class="relative overflow-hidden py-32 text-white" style="background: linear-gradient(135deg, #831843 0%, #EC4899 40%, #A855F7 100%);">
            <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 30% 40%, #F9A8D4 0%, transparent 50%), radial-gradient(circle at 70% 60%, #C084FC 0%, transparent 50%);"></div>
            <div class="absolute -left-10 top-10 h-40 w-40 rounded-full bg-yellow-400/10 blur-2xl"></div>
            <div class="absolute -right-10 bottom-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl"></div>
            <div class="relative mx-auto max-w-4xl px-4 text-center">
                <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur">
                    <span>🔥</span> 매주 일요일, 함께 모여 예배합니다
                </div>
                <h1 class="mb-6 text-4xl font-black leading-tight sm:text-5xl lg:text-7xl">
                    함께하는 예배 🙌
                </h1>
                <p class="mx-auto mb-10 max-w-xl text-lg text-pink-100">젊은 열정으로 하나님을 찬양하고, 서로 사랑하며 성장하는 공동체</p>
                <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href="/sermon" class="rounded-full bg-white px-8 py-4 font-bold text-[#831843] shadow-xl transition hover:scale-105 hover:shadow-2xl">이번 주 설교 보기 🎤</a>
                    <a href="/about" class="rounded-full border-2 border-white/30 px-8 py-4 font-medium text-white backdrop-blur transition hover:bg-white/10">우리 교회는요 👋</a>
                </div>
            </div>
        </section>

        <!-- Bible Verse -->
        <section class="border-b border-[#EC4899]/15 bg-gradient-to-r from-[#EC4899]/5 via-[#A855F7]/8 to-[#EC4899]/5 py-10">
            <div class="mx-auto max-w-3xl px-4 text-center">
                <div class="mb-3 text-2xl">💜</div>
                <blockquote class="text-lg font-semibold text-[#831843] sm:text-xl">
                    "누구든지 네 젊음을 업신여기지 못하게 하고"
                </blockquote>
                <p class="mt-3 text-sm font-medium text-[#EC4899]">— 디모데전서 4:12</p>
            </div>
        </section>

        <!-- Service Times -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-2 text-center text-3xl font-black text-[#831843]">예배 안내</h2>
                <p class="mb-10 text-center text-sm text-[#EC4899]">매 시간이 특별한 만남입니다 ✨</p>
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {#each [
                        ['🌅', '새벽기도', '매일 오전 5:30', '말씀과 기도로 하루를 시작!'],
                        ['🎤', '주일예배', '주일 오전 11:00', '함께 찬양하고 말씀을 나눠요'],
                        ['📖', '수요예배', '수요일 오후 7:30', '말씀 깊이 파고들기'],
                        ['🔥', '금요기도', '금요일 오후 8:00', '뜨겁게 기도하는 밤'],
                    ] as [icon, title, time, desc]}
                        <div class="rounded-3xl border border-[#EC4899]/15 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-100">
                            <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EC4899]/10 to-[#A855F7]/10 text-3xl">{icon}</div>
                            <h3 class="mb-1 text-lg font-bold text-[#831843]">{title}</h3>
                            <p class="mb-2 text-sm font-bold bg-gradient-to-r from-[#EC4899] to-[#A855F7] bg-clip-text text-transparent">{time}</p>
                            <p class="text-xs text-[#831843]/60">{desc}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Latest Sermon -->
        <section class="border-y border-[#EC4899]/15 bg-gradient-to-br from-[#EC4899]/5 to-[#A855F7]/5 py-16">
            <div class="mx-auto max-w-4xl px-4">
                <h2 class="mb-2 text-center text-3xl font-black text-[#831843]">이번 주 설교</h2>
                <p class="mb-10 text-center text-sm text-[#EC4899]">놓치지 마세요! 🎬</p>
                <div class="overflow-hidden rounded-3xl border border-[#EC4899]/15 bg-white shadow-xl shadow-pink-100">
                    <div class="flex aspect-video items-center justify-center bg-gradient-to-br from-[#EC4899]/10 to-[#A855F7]/10">
                        <div class="text-center">
                            <div class="mb-3 text-5xl">🎬</div>
                            <p class="text-sm text-[#EC4899]">설교 영상이 여기에 표시됩니다</p>
                            <a href="/sermon" class="mt-3 inline-block rounded-full bg-gradient-to-r from-[#EC4899] to-[#A855F7] px-5 py-2 text-sm font-bold text-white shadow-lg hover:shadow-xl">설교 목록 보기</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Church News -->
        <section class="py-16">
            <div class="mx-auto max-w-5xl px-4">
                <h2 class="mb-2 text-center text-3xl font-black text-[#831843]">교회 소식</h2>
                <p class="mb-10 text-center text-sm text-[#EC4899]">무슨 일이 일어나고 있을까요? 👀</p>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['📢', '공지사항', '교회의 중요한 소식을 확인하세요', '/notice'],
                        ['🙏', '기도 제목', '함께 기도해주세요', '/prayer'],
                        ['📅', '교회 일정', '이번 달 행사를 확인하세요', '/calendar'],
                    ] as [icon, title, desc, href]}
                        <a {href} class="group rounded-3xl border border-[#EC4899]/15 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-100">
                            <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EC4899] to-[#A855F7] text-2xl text-white shadow-md">{icon}</div>
                            <h3 class="mb-2 text-lg font-bold text-[#831843] group-hover:bg-gradient-to-r group-hover:from-[#EC4899] group-hover:to-[#A855F7] group-hover:bg-clip-text group-hover:text-transparent">{title}</h3>
                            <p class="text-sm text-[#831843]/60">{desc}</p>
                            <span class="mt-3 inline-block rounded-full bg-gradient-to-r from-[#EC4899]/10 to-[#A855F7]/10 px-3 py-1 text-xs font-bold text-[#EC4899]">바로가기 →</span>
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
    <footer class="border-t border-[#EC4899]/20 py-10 text-white" style="background: linear-gradient(135deg, #831843, #EC4899, #A855F7);">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <span class="text-xl">🎵</span>
                        <span class="text-lg font-bold">함께하는 예배</span>
                    </div>
                    <p class="text-sm text-pink-200">젊은 열정으로 하나님을 찬양하는 공동체</p>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">예배 시간</h4>
                    <div class="space-y-1 text-sm text-pink-200">
                        <p>주일예배: 오전 11:00</p>
                        <p>수요예배: 오후 7:30</p>
                        <p>새벽기도: 오전 5:30</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 font-bold">연락처</h4>
                    <div class="space-y-1 text-sm text-pink-200">
                        <p>서울특별시 OO구 OO로 123</p>
                        <p>02-1234-5678</p>
                        <p>youth@church.re.kr</p>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-white/20 pt-6 text-center text-xs text-pink-200">
                <p>Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a></p>
            </div>
        </div>
    </footer>
</div>
