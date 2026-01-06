<script lang="ts">
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	// 테마 설정 가져오기
	const brandColor = '#FFD700'; // 다모앙 노란색
	const showLogo = true;
</script>

<svelte:head>
	<style>
		:root {
			--brand-color: {brandColor};
			--text-dark: #333;
			--border-color: #ddd;
			--bg-light: #f8f9fa;
		}
	</style>
</svelte:head>

<div class="damoang-legacy-theme">
	<!-- 헤더 -->
	<header class="site-header">
		<div class="container">
			<div class="header-inner">
				{#if showLogo}
					<div class="logo">
						<a href="/">
							<div class="logo-box">
								<span class="logo-text">다모앙</span>
							</div>
						</a>
					</div>
				{/if}

				<nav class="main-nav">
					<ul>
						<li><a href="/">홈</a></li>
						<li><a href="/free">자유게시판</a></li>
						<li><a href="/qa">질문과 답변</a></li>
						<li><a href="/gallery">갤러리</a></li>
						<li><a href="/notice">공지사항</a></li>
					</ul>
				</nav>
			</div>
		</div>
	</header>

	<!-- 메인 콘텐츠 -->
	<main class="site-main">
		<div class="container">
			<div class="content-wrapper">
				{@render children()}
			</div>
		</div>
	</main>

	<!-- 푸터 -->
	<footer class="site-footer">
		<div class="container">
			<p class="copyright">© 2025 Damoang. All rights reserved.</p>
			<p class="powered-by">Powered by Angple</p>
		</div>
	</footer>
</div>

<style>
	.damoang-legacy-theme {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: #fff;
	}

	/* 헤더 */
	.site-header {
		background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		padding: 1rem 0;
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.logo {
		display: flex;
		align-items: center;
	}

	.logo-box {
		background: #000;
		color: #fff;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-weight: bold;
		font-size: 1.5rem;
		box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.2);
		transform: skew(-5deg);
	}

	.logo-text {
		display: inline-block;
		transform: skew(5deg);
	}

	.main-nav ul {
		display: flex;
		list-style: none;
		gap: 2rem;
		margin: 0;
		padding: 0;
	}

	.main-nav a {
		color: #333;
		text-decoration: none;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.main-nav a:hover {
		background: rgba(255, 255, 255, 0.5);
		color: #000;
	}

	/* 컨테이너 */
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	/* 메인 콘텐츠 */
	.site-main {
		flex: 1;
		padding: 2rem 0;
	}

	.content-wrapper {
		background: #fff;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	/* 푸터 */
	.site-footer {
		background: #333;
		color: #fff;
		padding: 2rem 0;
		text-align: center;
		margin-top: auto;
	}

	.copyright {
		margin: 0 0 0.5rem 0;
	}

	.powered-by {
		margin: 0;
		opacity: 0.7;
		font-size: 0.875rem;
	}

	/* 반응형 */
	@media (max-width: 768px) {
		.header-inner {
			flex-direction: column;
			gap: 1rem;
		}

		.main-nav ul {
			gap: 1rem;
			flex-wrap: wrap;
			justify-content: center;
		}

		.logo-box {
			font-size: 1.25rem;
			padding: 0.5rem 1rem;
		}

		.content-wrapper {
			padding: 1rem;
		}
	}
</style>
