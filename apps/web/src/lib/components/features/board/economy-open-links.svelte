<script lang="ts">
    // 모든 링크열기 버튼 - economy 게시판 전용
    // 본문 영역의 모든 링크를 백그라운드 탭으로 순차 오픈

    interface Props {
        containerId?: string;
    }

    let { containerId = 'economy-post-content' }: Props = $props();

    async function openAllLinks() {
        const container = document.getElementById(containerId);
        if (!container) return;

        const links = container.querySelectorAll('a');
        const urls: string[] = [];

        links.forEach((link) => {
            // 이미지 링크 제외, 텍스트 없는 링크 제외
            if (!link.querySelector('img') && link.innerText.trim() !== '') {
                urls.push(link.href);
            }
        });

        if (urls.length === 0) return;

        // 100ms 간격으로 순차적으로 열기
        for (let i = 0; i < urls.length; i++) {
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    const newTab = window.open(urls[i], '_blank', 'noopener,noreferrer');
                    if (newTab) {
                        newTab.blur();
                        window.focus();
                    }
                    resolve();
                }, i * 100);
            });
        }
    }
</script>

<button
    onclick={openAllLinks}
    class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
>
    모든 링크열기
    <br />
    <span class="text-[75%] leading-tight opacity-80">(팝업차단시 동작안함. M.Safari 안됨)</span>
</button>
