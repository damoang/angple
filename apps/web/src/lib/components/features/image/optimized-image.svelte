<script lang="ts">
	/**
	 * 최적화된 이미지 컴포넌트
	 *
	 * - WebP/AVIF 포맷 자동 선택 (picture + source)
	 * - lazy loading
	 * - 반응형 sizes + srcset
	 * - 종횡비 유지로 CLS 방지
	 */

	interface Props {
		src: string;
		alt: string;
		width?: number;
		height?: number;
		sizes?: string;
		class?: string;
		loading?: 'lazy' | 'eager';
		/** 이미지 변환 API URL 패턴 (예: /api/image?url={url}&w={w}&f={f}) */
		transformUrl?: (src: string, width: number, format: string) => string;
	}

	let {
		src,
		alt,
		width,
		height,
		sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
		class: className = '',
		loading = 'lazy',
		transformUrl
	}: Props = $props();

	// 기본 srcset 너비 배열
	const widths = [320, 640, 768, 1024, 1280];

	function buildSrcset(format: string): string {
		if (!transformUrl) return '';
		return widths.map((w) => `${transformUrl(src, w, format)} ${w}w`).join(', ');
	}

	const avifSrcset = $derived(buildSrcset('avif'));
	const webpSrcset = $derived(buildSrcset('webp'));
	const hasTransform = $derived(Boolean(transformUrl));

	// 종횡비 계산 (CLS 방지)
	const aspectRatio = $derived(width && height ? `${width} / ${height}` : undefined);
</script>

{#if hasTransform}
	<picture>
		{#if avifSrcset}
			<source type="image/avif" srcset={avifSrcset} {sizes} />
		{/if}
		{#if webpSrcset}
			<source type="image/webp" srcset={webpSrcset} {sizes} />
		{/if}
		<img
			{src}
			{alt}
			{width}
			{height}
			{loading}
			decoding="async"
			class={className}
			style:aspect-ratio={aspectRatio}
		/>
	</picture>
{:else}
	<img
		{src}
		{alt}
		{width}
		{height}
		{loading}
		decoding="async"
		class={className}
		style:aspect-ratio={aspectRatio}
	/>
{/if}
