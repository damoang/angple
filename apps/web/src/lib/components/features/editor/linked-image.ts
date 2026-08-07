import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';

/**
 * LinkedImage — @tiptap/extension-image 확장
 *
 * 붙여넣기 시 <a href="..."><img src="..."></a> 형태의 링크를 보존한다.
 * ProseMirror의 Image 노드는 marks를 허용하지 않아 Link mark가 자동 제거되는데,
 * 이를 우회하기 위해 href/linkTarget을 노드 attribute로 관리한다.
 */
export const LinkedImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            // 이미지를 감싸는 <a> 태그의 href
            href: { default: null },
            // <a> 태그의 target 속성
            linkTarget: { default: null },
            // 작성자가 '본문 폭 맞춤'을 명시적으로 선택했는지. class="dm-fit-width" 로 저장·복원.
            // (렌더 시점 추측 없이, 저장된 의도만 존중 — content-image-sizing-architecture)
            fitWidth: {
                default: false,
                parseHTML: (el: HTMLElement) => el.classList?.contains('dm-fit-width') ?? false,
                renderHTML: (attrs: { fitWidth?: boolean }) =>
                    attrs.fitWidth ? { class: 'dm-fit-width' } : {}
            },
            // 작성자가 고른 표시 폭 프리셋(%). class="dm-w-25|50|75" 로 저장·복원 (bug/13379).
            // px(width attr)가 아니라 % 인 이유: 큰 사진은 px 절반도 모바일에서
            // max-width:100% 상한에 걸려 차이가 안 보인다. fitWidth 와 같은 원칙 —
            // 렌더 시점 추측 없이 저장된 의도만 존중. UI 가 fitWidth 와 상호 배타를 보장한다.
            sizePercent: {
                default: null,
                parseHTML: (el: HTMLElement) => {
                    for (const c of el.classList ?? []) {
                        const m = /^dm-w-(25|50|75)$/.exec(c);
                        if (m) return parseInt(m[1], 10);
                    }
                    return null;
                },
                renderHTML: (attrs: { sizePercent?: number | null }) =>
                    attrs.sizePercent ? { class: `dm-w-${attrs.sizePercent}` } : {}
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: this.options.allowBase64 ? 'img[src]' : 'img[src]:not([src^="data:"])',
                getAttrs: (dom: HTMLElement) => {
                    const img = dom as HTMLImageElement;
                    // 상위 <a> 태그에서 href 추출 (SunEditor: figure>a>img, 일반: a>img)
                    const link = img.closest('a');
                    return {
                        src: img.getAttribute('src'),
                        alt: img.getAttribute('alt'),
                        title: img.getAttribute('title'),
                        width: img.getAttribute('width'),
                        height: img.getAttribute('height'),
                        href: link?.getAttribute('href') || null,
                        linkTarget: link?.getAttribute('target') || null
                    };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { href, linkTarget, ...imgAttrs } = HTMLAttributes;
        const mergedImgAttrs = mergeAttributes(this.options.HTMLAttributes, imgAttrs);

        if (href) {
            return [
                'a',
                { href, target: linkTarget || '_blank', rel: 'noopener noreferrer' },
                ['img', mergedImgAttrs]
            ];
        }

        return ['img', mergedImgAttrs];
    }
});
