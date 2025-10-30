<script lang="ts">
    import { onMount } from 'svelte';

    // TOP 버튼 표시 여부
    let showTopButton = $state(false);

    // 스크롤 위치에 따른 TOP 버튼 표시/숨김 처리
    function handleScroll() {
        showTopButton = window.scrollY > 300;
    }

    // TOP 버튼 클릭 시 페이지 최상단으로 스크롤
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // 컴포넌트 마운트 시 스크롤 이벤트 등록
    onMount(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    });
</script>

<!-- 오른쪽 배너 영역 - 스켈레톤 박스 -->
<div
    class="border-border bg-dusty-200 dark:bg-dusty-700 flex w-full items-center justify-center rounded-lg border-2 border-dashed p-2"
>
    <div class="bg-dusty-100 text-dusty-600 dark:text-dusty-400 h-[600px] w-[160px] text-center flex items-center justify-center">
        <div class="-rotate-90 transform whitespace-nowrap text-sm font-medium">
            오른쪽 배너 영역
        </div>
    </div>
</div>

<!-- TOP 버튼 - 오른쪽 하단 -->
{#if showTopButton}
    <div class="fixed right-6 z-40">
        <button
            onclick={scrollToTop}
            class="group flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 hover:bg-blue-700"
            aria-label="페이지 상단으로 이동"
        >
            <svg
                class="h-5 w-5 transform transition-transform group-hover:-translate-y-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
            </svg>
        </button>
    </div>
{/if}
