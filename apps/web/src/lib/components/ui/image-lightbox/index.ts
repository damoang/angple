import { mount, unmount } from 'svelte';
import ImageLightbox from './image-lightbox.svelte';

// 싱글톤 인스턴스 관리
let lightboxInstance: ReturnType<typeof mount> | null = null;
let lightboxRef: { open: (images: { src: string; alt: string }[], index: number) => void } | null =
    null;

/**
 * 라이트박스 싱글톤 인스턴스 가져오기 (없으면 생성)
 */
function getLightbox() {
    if (!lightboxInstance) {
        // body에 컨테이너 생성
        const container = document.createElement('div');
        container.id = 'image-lightbox-root';
        document.body.appendChild(container);

        // Svelte 5 mount API로 컴포넌트 마운트
        lightboxInstance = mount(ImageLightbox, {
            target: container
        });

        // mount가 반환하는 객체에서 export된 함수 접근
        lightboxRef = lightboxInstance as unknown as {
            open: (images: { src: string; alt: string }[], index: number) => void;
        };
    }
    return lightboxRef!;
}

/**
 * 컨테이너 내 모든 이미지에 라이트박스 클릭 핸들러 부착
 * @param container - 이미지를 검색할 HTML 컨테이너 요소
 * @returns 정리(cleanup) 함수
 */
export function attachLightbox(container: HTMLElement): () => void {
    const handlers: Array<{ img: HTMLImageElement; handler: (e: Event) => void }> = [];

    function setup() {
        // 기존 핸들러 정리
        cleanup();

        const imgs = container.querySelectorAll<HTMLImageElement>('img:not(.emoticon-inline)');
        if (imgs.length === 0) return;

        // 이미지 목록 구성 (data-original 우선, 없으면 src)
        const imageList = Array.from(imgs).map((img) => ({
            src: img.getAttribute('data-original') || img.src,
            alt: img.alt || ''
        }));

        imgs.forEach((img, index) => {
            // 클릭 가능 스타일 추가
            img.style.cursor = 'zoom-in';

            const handler = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                const lightbox = getLightbox();
                lightbox.open(imageList, index);
            };

            img.addEventListener('click', handler);
            handlers.push({ img, handler });
        });
    }

    function cleanup() {
        for (const { img, handler } of handlers) {
            img.removeEventListener('click', handler);
            img.style.cursor = '';
        }
        handlers.length = 0;
    }

    // MutationObserver로 동적 콘텐츠 변경 감지
    const observer = new MutationObserver(() => {
        setup();
    });

    observer.observe(container, { childList: true, subtree: true });

    // 초기 설정
    setup();

    // 정리 함수 반환
    return () => {
        cleanup();
        observer.disconnect();
    };
}

/**
 * 라이트박스 싱글톤 인스턴스 제거 (필요 시)
 */
export function destroyLightbox() {
    if (lightboxInstance) {
        unmount(lightboxInstance);
        lightboxInstance = null;
        lightboxRef = null;
        const el = document.getElementById('image-lightbox-root');
        el?.remove();
    }
}
