<script lang="ts">
    import { untrack } from 'svelte';

    // 이미지 목록과 현재 인덱스
    let images: { src: string; alt: string }[] = $state([]);
    let currentIndex = $state(0);
    let isOpen = $state(false);
    let isZoomed = $state(false);
    let isLoading = $state(true);
    let opacity = $state(0);

    // 현재 이미지
    let currentImage = $derived(images[currentIndex]);
    let hasMultiple = $derived(images.length > 1);
    let counter = $derived(`${currentIndex + 1} / ${images.length}`);

    // 라이트박스 열기
    export function open(imageList: { src: string; alt: string }[], index: number) {
        images = imageList;
        currentIndex = index;
        isZoomed = false;
        isLoading = true;
        isOpen = true;
        // 다음 프레임에서 opacity 전환 시작
        requestAnimationFrame(() => {
            opacity = 1;
        });
        document.body.style.overflow = 'hidden';
    }

    // 라이트박스 닫기
    function close() {
        opacity = 0;
        setTimeout(() => {
            isOpen = false;
            isZoomed = false;
            document.body.style.overflow = '';
        }, 200);
    }

    // 이전/다음 이미지
    function prev() {
        if (!hasMultiple) return;
        isLoading = true;
        isZoomed = false;
        currentIndex = (currentIndex - 1 + images.length) % images.length;
    }

    function next() {
        if (!hasMultiple) return;
        isLoading = true;
        isZoomed = false;
        currentIndex = (currentIndex + 1) % images.length;
    }

    // 줌 토글
    function toggleZoom() {
        isZoomed = !isZoomed;
    }

    // 이미지 로드 완료
    function handleImageLoad() {
        isLoading = false;
    }

    // 키보드 이벤트
    function handleKeydown(e: KeyboardEvent) {
        if (!isOpen) return;
        switch (e.key) {
            case 'Escape':
                close();
                break;
            case 'ArrowLeft':
                prev();
                break;
            case 'ArrowRight':
                next();
                break;
        }
    }

    // 오버레이 클릭 (이미지 외부)
    function handleOverlayClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('lightbox-overlay')) {
            close();
        }
    }

    // 키보드 리스너 등록/해제
    $effect(() => {
        if (isOpen) {
            // untrack으로 handleKeydown 참조 안정화
            const handler = untrack(() => handleKeydown);
            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        }
    });
</script>

{#if isOpen && currentImage}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="lightbox-overlay"
        style="opacity: {opacity}"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <!-- 닫기 버튼 -->
        <button class="lightbox-close" onclick={close} aria-label="닫기">
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>

        <!-- 이미지 카운터 -->
        {#if hasMultiple}
            <div class="lightbox-counter">{counter}</div>
        {/if}

        <!-- 이전 버튼 -->
        {#if hasMultiple}
            <button class="lightbox-nav lightbox-prev" onclick={prev} aria-label="이전 이미지">
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
        {/if}

        <!-- 이미지 -->
        <div class="lightbox-image-wrap">
            {#if isLoading}
                <div class="lightbox-spinner">
                    <div class="spinner"></div>
                </div>
            {/if}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <img
                src={currentImage.src}
                alt={currentImage.alt}
                class="lightbox-image"
                class:zoomed={isZoomed}
                onclick={toggleZoom}
                onload={handleImageLoad}
                draggable="false"
                style="touch-action: pinch-zoom; cursor: {isZoomed ? 'zoom-out' : 'zoom-in'};"
            />
        </div>

        <!-- 다음 버튼 -->
        {#if hasMultiple}
            <button class="lightbox-nav lightbox-next" onclick={next} aria-label="다음 이미지">
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        {/if}
    </div>
{/if}

<style>
    /* 오버레이 */
    .lightbox-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.9);
        transition: opacity 0.2s ease;
        user-select: none;
        -webkit-user-select: none;
    }

    /* 닫기 버튼 */
    .lightbox-close {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        transition: background 0.15s;
    }

    .lightbox-close:hover {
        background: rgba(255, 255, 255, 0.25);
    }

    /* 이미지 카운터 */
    .lightbox-counter {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
    }

    /* 네비게이션 버튼 */
    .lightbox-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        transition: background 0.15s;
    }

    .lightbox-nav:hover {
        background: rgba(255, 255, 255, 0.25);
    }

    .lightbox-prev {
        left: 16px;
    }

    .lightbox-next {
        right: 16px;
    }

    /* 이미지 래퍼 */
    .lightbox-image-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 48px 80px;
        overflow: auto;
    }

    /* 이미지 */
    .lightbox-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.2s ease;
        border-radius: 4px;
    }

    .lightbox-image.zoomed {
        max-width: none;
        max-height: none;
        transform: none;
        cursor: zoom-out;
    }

    /* 로딩 스피너 */
    .lightbox-spinner {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* 모바일 대응 */
    @media (max-width: 640px) {
        .lightbox-image-wrap {
            padding: 48px 16px;
        }

        .lightbox-nav {
            width: 36px;
            height: 36px;
        }

        .lightbox-prev {
            left: 8px;
        }

        .lightbox-next {
            right: 8px;
        }
    }
</style>
