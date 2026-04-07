<script lang="ts">
    import type { Snippet } from 'svelte';
    import { page } from '$app/stores';

    interface Props { children: Snippet; }
    const { children }: Props = $props();
    const isHomePage = $derived($page.url.pathname === '/');

    const navItems = [
        { label: '홈', href: '/' },
        { label: '설교', href: '/sermon' },
        { label: '소개', href: '/about' },
        { label: '공지', href: '/notice' },
        { label: '기도', href: '/prayer' },
        { label: '위치', href: '/location' },
    ];

    let mobileMenuOpen = $state(false);
</script>

<svelte:head>
    <title>모던 교회 — 현대적 감성으로 만나는 예배</title>
    <meta name="description" content="미니멀하고 세련된 현대적 교회. 새로운 방식으로 하나님을 만납니다." />
</svelte:head>

<div class="flex min-h-screen flex-col bg-white">
    <!-- Header: 네이비 미니멀 -->
    <header class="sticky top-0 z-50 bg-[#0F172A] text-white">
        <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded border border-white/20">
                    <span class="text-sm font-light">+</span>
                </div>
                <span class="text-sm font-medium tracking-wider">MODERN CHURCH</span>
            </a>
            <nav class="hidden items-center gap-6 lg:flex">
                {#each navItems as item}
                    <a href={item.href} class="text-xs font-medium uppercase tracking-widest text-white/60 transition hover:text-white {$page.url.pathname === item.href ? 'text-white' : ''}">{item.label}</a>
                {/each}
            </nav>
            <div class="flex items-center gap-3">
                <a href="/login" class="hidden rounded border border-white/20 px-4 py-1.5 text-xs font-medium tracking-wider transition hover:bg-white/10 sm:block">LOGIN</a>
                <button class="text-white/60 hover:text-white lg:hidden" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>
        {#if mobileMenuOpen}
            <div class="border-t border-white/10 px-4 py-4 lg:hidden">
                {#each navItems as item}
                    <a href={item.href} class="block py-2 text-sm text-white/60 hover:text-white" onclick={() => mobileMenuOpen = false}>{item.label}</a>
                {/each}
            </div>
        {/if}
    </header>

    {#if isHomePage}
        <!-- Hero: 풀스크린 다크 -->
        <section class="relative flex min-h-[85vh] items-center justify-center bg-[#0F172A] text-white">
            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 40px 40px;"></div>
            <div class="relative mx-auto max-w-3xl px-4 text-center">
                <p class="mb-6 text-xs font-medium uppercase tracking-[0.3em] text-blue-400">Welcome</p>
                <h1 class="mb-6 text-5xl font-extralight leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                    새로운<br/><span class="font-bold">시작</span>
                </h1>
                <div class="mx-auto mb-10 h-px w-20 bg-blue-400"></div>
                <p class="mb-10 text-lg font-light text-white/60">현대적 감성으로 만나는 예배</p>
                <a href="/sermon" class="inline-block rounded bg-blue-500 px-8 py-3 text-sm font-medium tracking-wider transition hover:bg-blue-400">WATCH SERMON</a>
            </div>
        </section>

        <!-- 예배 시간 -->
        <section class="border-b py-20">
            <div class="mx-auto max-w-5xl px-4">
                <p class="mb-2 text-center text-xs font-medium uppercase tracking-[0.3em] text-blue-500">Service Times</p>
                <h2 class="mb-12 text-center text-3xl font-light text-[#0F172A]">예배 안내</h2>
                <div class="grid grid-cols-2 gap-px bg-gray-200 lg:grid-cols-4">
                    {#each [
                        ['SUN', '주일예배', '11:00 AM'],
                        ['WED', '수요예배', '7:30 PM'],
                        ['FRI', '금요기도', '8:00 PM'],
                        ['DAILY', '새벽기도', '5:30 AM'],
                    ] as [day, name, time]}
                        <div class="bg-white p-8 text-center">
                            <p class="mb-1 text-xs font-bold tracking-widest text-blue-500">{day}</p>
                            <h3 class="mb-2 text-lg font-medium text-[#0F172A]">{name}</h3>
                            <p class="text-sm text-gray-400">{time}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- 말씀 -->
        <section class="bg-[#F8FAFC] py-20">
            <div class="mx-auto max-w-2xl px-4 text-center">
                <div class="mb-6 text-5xl text-gray-200">"</div>
                <blockquote class="mb-4 text-xl font-light leading-relaxed text-[#0F172A]">
                    이 세상이나 세상에 있는 것들을 사랑하지 말라.<br/>누구든지 세상을 사랑하면 아버지의 사랑이<br/>그 안에 있지 아니하니
                </blockquote>
                <p class="text-sm text-gray-400">요한일서 2:15</p>
            </div>
        </section>

        <!-- 설교 -->
        <section class="py-20">
            <div class="mx-auto max-w-4xl px-4">
                <p class="mb-2 text-center text-xs font-medium uppercase tracking-[0.3em] text-blue-500">Latest Sermon</p>
                <h2 class="mb-12 text-center text-3xl font-light text-[#0F172A]">이번 주 설교</h2>
                <div class="overflow-hidden rounded-lg bg-[#0F172A]" style="aspect-ratio: 16/9;">
                    <div class="flex h-full items-center justify-center">
                        <div class="text-center text-white/40">
                            <div class="mb-3 text-5xl">▶</div>
                            <p class="text-sm">설교 영상</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 소식 카드 -->
        <section class="border-t bg-[#F8FAFC] py-20">
            <div class="mx-auto max-w-5xl px-4">
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {#each [
                        ['공지사항', '교회의 중요한 소식', '/notice'],
                        ['기도 제목', '함께 기도해주세요', '/prayer'],
                        ['교회 일정', '이번 달 행사', '/calendar'],
                    ] as [title, desc, href]}
                        <a {href} class="group border-b-2 border-transparent bg-white p-8 transition hover:border-blue-500 hover:shadow-lg">
                            <h3 class="mb-2 text-lg font-medium text-[#0F172A]">{title}</h3>
                            <p class="mb-4 text-sm text-gray-400">{desc}</p>
                            <span class="text-xs font-medium uppercase tracking-widest text-blue-500">View →</span>
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
    <footer class="bg-[#0F172A] py-12 text-white">
        <div class="mx-auto max-w-6xl px-4">
            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div>
                    <div class="mb-3 flex items-center gap-2">
                        <div class="flex h-6 w-6 items-center justify-center rounded border border-white/20 text-xs">+</div>
                        <span class="text-sm font-medium tracking-wider">MODERN CHURCH</span>
                    </div>
                    <p class="text-xs text-white/40">현대적 감성으로 만나는 예배</p>
                </div>
                <div>
                    <h4 class="mb-3 text-xs font-medium uppercase tracking-widest text-white/60">Service</h4>
                    <div class="space-y-1 text-xs text-white/40">
                        <p>주일예배 11:00 AM</p>
                        <p>수요예배 7:30 PM</p>
                        <p>새벽기도 5:30 AM</p>
                    </div>
                </div>
                <div>
                    <h4 class="mb-3 text-xs font-medium uppercase tracking-widest text-white/60">Contact</h4>
                    <div class="space-y-1 text-xs text-white/40">
                        <p>서울특별시 OO구 OO로 456</p>
                        <p>02-9876-5432</p>
                    </div>
                </div>
            </div>
            <div class="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/20">
                Powered by <a href="https://church.re.kr" class="underline">처치레(ChurchRe)</a>
            </div>
        </div>
    </footer>
</div>
