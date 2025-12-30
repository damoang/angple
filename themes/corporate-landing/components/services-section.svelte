<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Services Section Component
     *
     * 서비스 소개 섹션
     * - 그리드 레이아웃
     * - 아이콘 + 설명
     * - 호버 효과
     */

    onMount(() => {
        console.log('🛠️ Services Section 마운트됨');
    });

    // TODO: Phase 3에서 blocks.json으로 데이터 관리
    const services = [
        {
            icon: '🚀',
            title: '커뮤니티 플랫폼',
            description: 'Angple 기반 커뮤니티 구축 솔루션'
        },
        {
            icon: '🎨',
            title: '웹 디자인',
            description: '모던하고 세련된 웹사이트 디자인'
        },
        {
            icon: '⚡',
            title: '성능 최적화',
            description: '빠르고 안정적인 웹 서비스'
        }
    ];
</script>

<!--
    TODO: Phase 2에서 구현
    - sdkcorp의 Services 디자인 변환
    - 카드 스타일링
    - 애니메이션
 -->
<section class="px-4 py-24">
    <div class="container mx-auto">
        <h2 class="mb-12 text-center text-4xl font-bold">Our Services</h2>

        <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {#each services as service}
                <div
                    class="rounded-xl bg-white p-8 shadow-lg transition-transform hover:scale-105"
                >
                    <div class="mb-4 text-5xl">{service.icon}</div>
                    <h3 class="mb-2 text-2xl font-bold">{service.title}</h3>
                    <p class="text-gray-600">{service.description}</p>
                </div>
            {/each}
        </div>
    </div>
</section>
