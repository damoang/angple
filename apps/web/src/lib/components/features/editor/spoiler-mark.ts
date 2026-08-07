import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        spoilerInline: {
            /** 선택 텍스트에 인라인 스포일러(모자이크) 마크를 토글한다 */
            toggleSpoilerInline: () => ReturnType;
        };
    }
}

/**
 * SpoilerInline — <b> 처럼 선택 부분에만 거는 모자이크 마크 (8/7 사장님 요청).
 *
 * 저장 형태 = `<span class="dm-spoiler">…</span>`.
 * - 뷰(본문 markdown.svelte · 댓글 comment-list.svelte)가 가림/해제 CSS·클릭 토글을 가진다.
 *   PC 는 드래그(::selection)로도 보인다. 두 표면 모두에 CSS 가 있어야 한다(복붙 표면 함정).
 * - 블록형 [spoiler](details 변환, content-transform.ts)와는 별개 — 이쪽은 줄 안 일부분용.
 * - ⛔ 글 저장이 Turndown(HTML→md)을 타므로, tiptap-editor 의 turndown 인스턴스에
 *   이 span 을 보존하는 keep 규칙이 반드시 있어야 한다. 없으면 저장 순간 벗겨진다.
 */
export const SpoilerInline = Mark.create({
    name: 'spoilerInline',

    parseHTML() {
        return [{ tag: 'span.dm-spoiler' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'dm-spoiler' }), 0];
    },

    addCommands() {
        return {
            toggleSpoilerInline:
                () =>
                ({ commands }) =>
                    commands.toggleMark(this.name)
        };
    }
});
