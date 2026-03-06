/**
 * 코드 구문 하이라이팅 유틸리티
 * highlight.js common 번들 (~37개 주요 언어) 사용
 * 본문(markdown.svelte) + 댓글(comment-list.svelte) 공용
 */
import hljs from 'highlight.js/lib/common';

/**
 * 컨테이너 내의 모든 <pre><code> 블록에 구문 하이라이팅 적용
 * DOM 렌더링 이후 호출해야 함
 */
export function highlightAllCodeBlocks(container: HTMLElement): void {
    const blocks = container.querySelectorAll<HTMLElement>('pre code');
    for (const block of blocks) {
        // 이미 하이라이팅된 블록은 건너뜀
        if (block.dataset.highlighted === 'yes') continue;
        hljs.highlightElement(block);
    }
}
