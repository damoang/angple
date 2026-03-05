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
						linkTarget: link?.getAttribute('target') || null,
					};
				},
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		const { href, linkTarget, ...imgAttrs } = HTMLAttributes;
		const mergedImgAttrs = mergeAttributes(this.options.HTMLAttributes, imgAttrs);

		if (href) {
			return [
				'a',
				{ href, target: linkTarget || '_blank', rel: 'noopener noreferrer' },
				['img', mergedImgAttrs],
			];
		}

		return ['img', mergedImgAttrs];
	},
});
