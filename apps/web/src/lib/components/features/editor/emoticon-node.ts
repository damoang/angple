import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Emoticon — 본문 에디터에서 앙티콘을 **글씨처럼** 다루는 인라인 노드.
 *
 * ## 왜 별도 노드인가
 *
 * 본문 에디터의 이미지는 `LinkedImage`(`inline: false`)가 담당한다. 그 설정 때문에
 * 앙티콘도 블록으로 들어가 **한 줄을 통째로 차지했다.** 실제 저장된 글을 보면
 * `<img>` 가 `<p>` 의 형제로 최상위에 놓인다:
 *
 * ```html
 * <img src="/emoticons/onion-021.gif"><p>ㄷㄷㄷㄷ</p>
 * ```
 *
 * 반면 댓글 에디터는 `Image.configure({ inline: true })` 라 처음부터 옆으로 붙었다.
 * 즉 같은 기능이 두 화면에서 다르게 동작하고 있었다.
 *
 * ⛔ **`LinkedImage` 의 `inline` 을 뒤집어 해결하지 말 것.** 그 노드는 **사진 첨부에도
 *    같이 쓰인다.** 인라인이 되면 큰 사진이 문단 안으로 끼어들어 본문 레이아웃이 무너진다.
 *    앙티콘만 담는 노드를 따로 두는 이유다.
 *
 * ## atom 인 이유
 *
 * 앙티콘은 내부를 편집할 것이 없다. `atom: true` 로 두면 커서가 통째로 지나가고
 * 백스페이스 한 번에 하나가 지워진다 — 글자와 같은 감각이 된다.
 *
 * ## ⛔ priority 가 핵심이다
 *
 * `LinkedImage` 의 파스 규칙은 `img[src]` 로 **모든 이미지**를 잡는다. 이 노드가 먼저
 * 평가되지 않으면 기존 글을 수정하려고 열 때 앙티콘이 도로 블록 이미지로 잡혀
 * 원래대로 돌아간다. 확장 우선순위와 파스 규칙 우선순위를 **둘 다** 올려 둔다.
 *
 * ## 알려진 영향
 *
 * 기존 글은 `<img>` 가 문단 **밖**에 저장돼 있다. 그 글을 **수정하려고 열면** 앙티콘이
 * 인접 문단 안으로 들어오고, 저장하면 HTML 구조가 바뀐다. 보이는 결과는 자연스럽지만
 * 작성자가 건드리지 않은 부분이 바뀌는 것이므로 검증 항목에 포함한다.
 * 읽기 전용 경로(목록·상세)는 DB 를 그대로 렌더하므로 영향이 없다.
 */
export const Emoticon = Node.create({
    name: 'emoticon',

    // Image 계열(기본 100)보다 먼저 스키마·파스 규칙이 평가되도록.
    priority: 1100,

    inline: true,
    group: 'inline',
    atom: true,
    draggable: false,
    selectable: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null }
        };
    },

    parseHTML() {
        return [
            {
                // 앙티콘은 항상 /emoticons/ 아래에서 온다 — 사진 첨부와 겹치지 않는다.
                tag: 'img[src^="/emoticons/"]',
                priority: 100
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        // class 는 렌더 CSS 와의 계약이다.
        // styles/components.css 의 `.emoticon-inline { display: inline; vertical-align: middle }`
        // 가 이 클래스를 읽는다. 바꾸려면 그쪽도 함께 봐야 한다.
        return ['img', mergeAttributes({ class: 'emoticon-inline' }, HTMLAttributes)];
    }
});
