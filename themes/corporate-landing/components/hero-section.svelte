<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Hero Section Component
     *
     * sdkcorp 디자인을 Svelte로 변환
     * - 다크 그라디언트 배경
     * - 그라디언트 텍스트 효과
     * - CTA 버튼
     * - 페이드인 애니메이션
     */

    // TODO: Phase 3에서 theme settings/blocks.json 연동
    const companyName = 'SDK Corp.';
    const subtitle = '혁신적인 IT 솔루션과 대한민국 대표 커뮤니티를 운영하며 디지털 혁신을 선도합니다.';

    const navigation = [
        { name: 'About', href: '/about' },
        { name: 'Projects', href: '/projects' },
        { name: 'Services', href: '/services' },
        { name: 'Contact', href: '/contact' }
    ];

    onMount(() => {
        console.log('🚀 Hero Section 마운트됨');
    });
</script>

<svelte:head>
    <style>
        @keyframes fade-in {
            0% {
                opacity: 0;
            }
            75% {
                opacity: 0;
            }
            100% {
                opacity: 1;
            }
        }

        @keyframes title-animation {
            0% {
                line-height: 0%;
                letter-spacing: 0.25em;
                opacity: 0;
            }
            25% {
                line-height: 0%;
                opacity: 0;
            }
            80% {
                opacity: 1;
            }
            100% {
                line-height: 100%;
                opacity: 1;
            }
        }

        @keyframes fade-left {
            0% {
                transform: translateX(100%);
                opacity: 0;
            }
            30% {
                transform: translateX(0%);
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }

        @keyframes fade-right {
            0% {
                transform: translateX(-100%);
                opacity: 0;
            }
            30% {
                transform: translateX(0%);
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }

        .animate-fade-in {
            animation: fade-in 3s ease-in-out forwards;
        }

        .animate-title {
            animation: title-animation 3s ease-out forwards;
        }

        .animate-fade-left {
            animation: fade-left 3s ease-in-out forwards;
        }

        .animate-fade-right {
            animation: fade-right 3s ease-in-out forwards;
        }

        .animate-glow {
            animation: glow 2s ease-in-out infinite alternate;
        }

        @keyframes glow {
            from {
                opacity: 0.3;
            }
            to {
                opacity: 0.6;
            }
        }
    </style>
</svelte:head>

<!-- sdkcorp Hero Section 디자인 -->
<div
    class="relative flex min-h-screen w-screen flex-col items-center justify-center overflow-x-hidden bg-gradient-to-br from-black via-zinc-900/50 to-black"
>
    <!-- Background gradient mesh -->
    <div
        class="absolute inset-0 animate-glow bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10"
    ></div>

    <!-- Navigation -->
    <nav class="z-10 my-16 animate-fade-in">
        <ul class="flex items-center justify-center gap-6">
            {#each navigation as item, index}
                <a
                    href={item.href}
                    class="transform text-sm font-medium text-zinc-400 transition-all duration-500 hover:scale-110 hover:text-white"
                    style="animation-delay: {index * 100}ms"
                >
                    {item.name}
                </a>
            {/each}
        </ul>
    </nav>

    <!-- Top divider -->
    <div
        class="hidden h-px w-screen animate-fade-left bg-gradient-to-r from-transparent via-blue-500/50 to-transparent md:block"
    ></div>

    <!-- Main title with gradient -->
    <h1
        class="animate-title z-10 cursor-default whitespace-nowrap bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text px-0.5 py-3.5 text-5xl font-bold text-transparent duration-1000 transition-all hover:from-blue-400 hover:via-white hover:to-blue-400 sm:text-7xl md:text-9xl"
    >
        {companyName}
    </h1>

    <!-- Bottom divider -->
    <div
        class="hidden h-px w-screen animate-fade-right bg-gradient-to-r from-transparent via-blue-500/50 to-transparent md:block"
    ></div>

    <!-- Subtitle -->
    <div class="my-8 max-w-2xl animate-fade-in px-6 text-center">
        <h2 class="text-lg leading-relaxed text-zinc-300 md:text-xl">
            {subtitle}
        </h2>
    </div>

    <!-- CTA Buttons -->
    <div class="mt-8 flex animate-fade-in gap-4">
        <a
            href="/services"
            class="transform rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:scale-105 hover:bg-blue-500"
        >
            서비스 알아보기
        </a>
        <a
            href="/contact"
            class="transform rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-zinc-700"
        >
            문의하기
        </a>
    </div>

    <!-- Scroll indicator -->
    <div class="absolute bottom-8 animate-bounce">
        <svg
            class="h-6 w-6 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
        </svg>
    </div>
</div>
