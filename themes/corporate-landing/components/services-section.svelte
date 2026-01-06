<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Services Section Component
     *
     * sdkcorp 디자인을 Svelte로 변환
     * - 다크 그라디언트 배경
     * - 카드 호버 효과
     * - 아이콘 그라디언트 배경
     */

    onMount(() => {
        console.log('🛠️ Services Section 마운트됨');
    });

    // TODO: Phase 3에서 blocks.json으로 데이터 관리
    const services = [
        {
            icon: '🌐',
            title: '커뮤니티 플랫폼',
            description: 'Angple 기반 커뮤니티 구축 솔루션',
            features: ['실시간 트래픽 관리', '콘텐츠 모더레이션', '커뮤니티 운영', '사용자 지원']
        },
        {
            icon: '💻',
            title: '웹 플랫폼 개발',
            description: '모던 웹 기술 스택 기반 개발',
            features: ['SvelteKit', 'Go 백엔드', 'React/Next.js', '반응형 디자인']
        },
        {
            icon: '🛡️',
            title: '콘텐츠 관리',
            description: '안전한 커뮤니티 환경 조성',
            features: ['AI 기반 필터링', '신고 시스템', '콘텐츠 모니터링', '사용자 보호']
        }
    ];
</script>

<!-- sdkcorp Services Section 디자인 -->
<section class="bg-gradient-to-tl from-zinc-900/0 via-zinc-900 to-zinc-900/0 px-4 py-20">
    <div class="container mx-auto">
        <!-- Header -->
        <div class="mb-16 text-center">
            <h2 class="mb-4 text-5xl font-bold text-white">서비스</h2>
            <p class="mx-auto max-w-3xl text-xl text-zinc-400">
                혁신적인 IT 솔루션을 제공합니다
            </p>
        </div>

        <!-- Services Grid -->
        <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {#each services as service}
                <div
                    class="group h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80"
                >
                    <!-- Icon with gradient background -->
                    <div class="relative mb-6">
                        <div
                            class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 transition-transform duration-300 group-hover:scale-110"
                        >
                            <div class="text-4xl transition-colors group-hover:brightness-110">
                                {service.icon}
                            </div>
                        </div>
                    </div>

                    <!-- Title -->
                    <h3
                        class="mb-3 text-2xl font-bold text-white transition-colors group-hover:text-blue-300"
                    >
                        {service.title}
                    </h3>

                    <!-- Description -->
                    <p class="mb-6 text-zinc-400">{service.description}</p>

                    <!-- Features -->
                    <ul class="mb-6 flex-grow space-y-3">
                        {#each service.features as feature}
                            <li
                                class="flex items-start text-zinc-400 transition-colors group-hover:text-zinc-300"
                            >
                                <span class="mr-3 mt-0.5 text-green-500">
                                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                </span>
                                {feature}
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>

        <!-- CTA -->
        <div class="mt-16 text-center">
            <h3 class="mb-4 text-2xl font-bold text-white">프로젝트를 시작할 준비가 되셨나요?</h3>
            <p class="mb-8 text-zinc-400">함께 성공적인 비즈니스를 만들어가세요</p>
            <a
                href="/contact"
                class="inline-block rounded-lg bg-white px-8 py-4 font-semibold text-black transition hover:bg-zinc-200"
            >
                문의하기
            </a>
        </div>
    </div>
</section>
