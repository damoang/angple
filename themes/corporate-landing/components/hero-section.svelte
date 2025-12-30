<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Hero Section Component
     *
     * 메인 히어로 섹션
     * - 그라디언트 텍스트
     * - CTA 버튼
     * - 애니메이션
     */

    onMount(() => {
        console.log('🚀 Hero Section 마운트됨');
    });
</script>

<!--
    TODO: Phase 2에서 구현
    - sdkcorp의 Hero 디자인 변환
    - 그라디언트 텍스트 효과
    - CTA 버튼
    - Framer Motion → Svelte transition
 -->
<section class="relative flex min-h-screen items-center justify-center px-4">
    <div class="text-center">
        <h1
            class="mb-6 bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-9xl font-bold text-transparent"
        >
            Your Company
        </h1>
        <p class="mb-8 text-xl text-gray-600">Building the Future</p>

        <div class="flex justify-center gap-4">
            <a
                href="/services"
                class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
                서비스 알아보기
            </a>
            <a
                href="/contact"
                class="rounded-lg border-2 border-blue-600 px-6 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            >
                문의하기
            </a>
        </div>
    </div>
</section>
