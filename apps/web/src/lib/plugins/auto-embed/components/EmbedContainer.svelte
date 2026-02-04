<script lang="ts">
	import { onMount } from 'svelte';
	import type { EmbedInfo } from '../types.js';
	import { platforms } from '../platforms/index.js';

	interface Props {
		url?: string;
		info?: EmbedInfo;
		class?: string;
	}

	let { url, info: providedInfo, class: className = '' }: Props = $props();

	let embedInfo = $state<EmbedInfo | null>(null);
	let embedHtml = $state<string>('');
	let isBrowser = $state(false);

	onMount(() => {
		isBrowser = true;
	});

	// URL 또는 info가 변경되면 임베드 생성
	$effect(() => {
		if (!isBrowser) return;

		if (providedInfo) {
			embedInfo = providedInfo;
		} else if (url) {
			// URL에서 info 추출
			for (const platform of platforms) {
				const info = platform.extract(url);
				if (info) {
					embedInfo = info;
					break;
				}
			}
		}
	});

	// embedInfo가 변경되면 HTML 렌더링
	$effect(() => {
		if (!embedInfo) {
			embedHtml = '';
			return;
		}

		const platform = platforms.find(
			(p) => p.name === embedInfo!.platform || embedInfo!.platform.startsWith(p.name)
		);
		if (platform) {
			embedHtml = platform.render(embedInfo);
		}
	});

	// 스타일 계산
	const containerStyle = $derived.by(() => {
		if (!embedInfo) return '';

		const aspectRatio = embedInfo.aspectRatio || 56.25;
		const maxWidth = embedInfo.maxWidth ? `${embedInfo.maxWidth}px` : '100%';

		return `--aspect-ratio: ${aspectRatio}%; --max-width: ${maxWidth};`;
	});
</script>

{#if isBrowser && embedInfo && embedHtml}
	<div
		class="embed-container {className}"
		data-platform={embedInfo.platform}
		style={containerStyle}
	>
		{@html embedHtml}
	</div>
{:else if url}
	<!-- 임베딩 불가 시 일반 링크로 표시 -->
	<a href={url} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
		{url}
	</a>
{/if}

<style>
	.embed-container {
		position: relative;
		width: 100%;
		max-width: var(--max-width, 100%);
		margin: 1rem 0;
	}

	/* 가로세로 비율 유지 (기본 16:9) */
	.embed-container::before {
		content: '';
		display: block;
		padding-bottom: var(--aspect-ratio, 56.25%);
	}

	.embed-container :global(iframe),
	.embed-container :global(video),
	.embed-container :global(audio) {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 0.5rem;
	}

	/* 세로 영상 (Shorts, Reels, TikTok) */
	.embed-container[data-platform='youtube-shorts'],
	.embed-container[data-platform='instagram-reel'],
	.embed-container[data-platform='tiktok'] {
		margin-left: auto;
		margin-right: auto;
	}

	/* Twitter는 높이가 가변적 */
	.embed-container[data-platform='twitter'] {
		min-height: 250px;
	}

	.embed-container[data-platform='twitter']::before {
		display: none;
	}

	.embed-container[data-platform='twitter'] :global(iframe) {
		position: relative;
		min-height: 250px;
		height: auto;
	}
</style>
