<script lang="ts">
    /**
     * Muzia Landing Hero — slot: landing-hero
     * 다크 퍼플 그래디언트 히어로 섹션
     */
</script>

<section class="relative overflow-hidden py-20 text-center">
    <!-- 그래디언트 배경 -->
    <div
        class="absolute inset-0 -z-10 bg-gradient-to-br from-[#030213] via-[#0a0525] to-[#1a0533]"
    ></div>

    <!-- 플로팅 음표 장식 -->
    <div class="absolute left-10 top-20 animate-bounce text-4xl opacity-20">
        🎵
    </div>
    <div class="absolute bottom-20 right-10 animate-pulse text-5xl opacity-20">
        🎧
    </div>

    <div class="mx-auto max-w-3xl px-4">
        <h1
            class="text-4xl font-bold sm:text-5xl lg:text-6xl"
            style="background: linear-gradient(135deg, #ec4899, #9333ea); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
        >
            당신의 음악을, 모두와 함께
        </h1>
        <p class="mt-4 text-lg text-white/70">
            음악을 사랑하는 사람들의 커뮤니티
        </p>
        <div class="mt-8 flex justify-center gap-4">
            <a
                href="/feed"
                class="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                style="background: linear-gradient(135deg, #ec4899, #9333ea);"
            >
                피드 둘러보기
            </a>
            <a
                href="/register"
                class="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
                가입하기
            </a>
        </div>
    </div>
</section>
