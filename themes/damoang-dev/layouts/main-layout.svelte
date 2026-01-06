<script lang="ts">
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	// 테마 설정 가져오기
	const primaryColor = '#3b82f6';
	const enableDarkMode = true;
	const showLogo = true;
	const showTimeFilter = true;

	let darkMode = $state(false);

	const toggleDarkMode = () => {
		darkMode = !darkMode;
	};

	const timeFilters = ['1시간', '3시간', '6시간', '12시간', '24시간', '48시간'];
	let activeFilter = $state('1시간');
</script>

<svelte:head>
	<style>
		:root {
			--primary-color: {primaryColor};
			--text-dark: #1f2937;
			--text-light: #6b7280;
			--border-color: #e5e7eb;
			--bg-light: #f9fafb;
			--bg-card: #ffffff;
		}
	</style>
</svelte:head>

<div class="damoang-dev-theme" class:dark-mode={darkMode}>
	<!-- 헤더 -->
	<header class="site-header">
		<div class="container">
			<div class="header-inner">
				<!-- 좌측: 메뉴 + 로고 -->
				<div class="header-left">
					<button class="menu-btn" aria-label="메뉴">
						<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18M3 12h18M3 18h18" />
						</svg>
					</button>
					{#if showLogo}
						<a href="/" class="logo">
							<span class="logo-text">다모앙</span>
						</a>
					{/if}
				</div>

				<!-- 중앙: 네비게이션 -->
				<nav class="main-nav">
					<ul>
						<li><a href="/" class="nav-link">🏠</a></li>
						<li><a href="/home" class="nav-link">홈</a></li>
						<li><a href="/feed" class="nav-link">📰 피드</a></li>
					</ul>
				</nav>

				<!-- 우측: 유틸리티 -->
				<div class="header-right">
					{#if enableDarkMode}
						<button class="icon-btn" onclick={toggleDarkMode} aria-label="다크모드">
							<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
								{#if darkMode}
									<circle cx="10" cy="10" r="5" />
									<path d="M10 1v2m0 14v2M1 10h2m14 0h2m-3.343-6.657L14.5 4.5m-11 11l1.157-1.157m0-8.686L3.5 4.5m11 11l1.157 1.157" />
								{:else}
									<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
								{/if}
							</svg>
						</button>
					{/if}
					<button class="icon-btn" aria-label="검색">
						<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="9" cy="9" r="6" />
							<path d="M21 21l-6-6" />
						</svg>
					</button>
					<button class="icon-btn" aria-label="사용자">
						<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="10" cy="7" r="4" />
							<path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
						</svg>
					</button>
					<button class="icon-btn" aria-label="알림">
						<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- 메인 콘텐츠 -->
	<main class="site-main">
		<div class="container">
			<!-- 시간 필터 탭 -->
			{#if showTimeFilter}
				<div class="time-filter-tabs">
					{#each timeFilters as filter}
						<button
							class="time-tab"
							class:active={activeFilter === filter}
							onclick={() => (activeFilter = filter)}
						>
							{filter}
						</button>
					{/each}
				</div>
			{/if}

			<!-- 콘텐츠 영역 -->
			<div class="content-wrapper">
				{@render children()}
			</div>
		</div>
	</main>

	<!-- 푸터 -->
	<footer class="site-footer">
		<div class="container">
			<div class="footer-grid">
				<div class="footer-col">
					<h3>양포털</h3>
					<ul>
						<li><a href="#">디모양 지도 - 양지도</a></li>
						<li><a href="#">디모양 불법 - 땅터치</a></li>
						<li><a href="#">디모양 음악 - 뮤직타운</a></li>
						<li><a href="#">디모양 상생 - 양상생</a></li>
						<li><a href="#">디모양 영상 - 양팀방</a></li>
						<li><a href="#">X (구 트위터)</a></li>
					</ul>
				</div>
				<div class="footer-col">
					<h3>함께만들어가요</h3>
					<ul>
						<li><a href="#">공지사항</a></li>
						<li><a href="#">유지관리</a></li>
						<li><a href="#">디모양 만들기</a></li>
						<li><a href="#">이벤트 개인</a></li>
						<li><a href="#">디모양 개발지원 신청</a></li>
						<li><a href="#">광고임</a></li>
					</ul>
				</div>
				<div class="footer-col">
					<h3>시스템</h3>
					<ul>
						<li><a href="#">포인트 안내</a></li>
						<li><a href="#">레벨 안내</a></li>
						<li><a href="#">새글알림</a></li>
					</ul>
				</div>
				<div class="footer-col">
					<h3>🔴패밀리사이트</h3>
					<ul>
						<li><a href="#">영상포트</a></li>
						<li><a href="#">스팸커서넷</a></li>
						<li><a href="#">취업 신규 (뉴식 신청창 밑)</a></li>
						<li><a href="#">바이빅 신규 기블 (끝근 정장띠)</a></li>
						<li><a href="#">최외 이동창장 기블</a></li>
					</ul>
				</div>
			</div>
			<div class="footer-bottom">
				<p class="copyright">© SDK Co., Ltd. All rights reserved.</p>
				<p class="contact">
					페신/신고 : jebo@damoang.net, 문의(켁고 그러고 문의) : contact@damoang.net
				</p>
			</div>
		</div>
	</footer>
</div>

<style>
	.damoang-dev-theme {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: #f9fafb;
		color: #1f2937;
	}

	.dark-mode {
		background-color: #111827;
		color: #f9fafb;
	}

	/* 헤더 */
	.site-header {
		background: #ffffff;
		border-bottom: 1px solid #e5e7eb;
		padding: 1rem 0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.dark-mode .site-header {
		background: #1f2937;
		border-bottom-color: #374151;
	}

	.container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.menu-btn {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		transition: background-color 0.2s;
	}

	.menu-btn:hover {
		background: #f3f4f6;
	}

	.dark-mode .menu-btn:hover {
		background: #374151;
	}

	.logo {
		font-size: 1.5rem;
		font-weight: bold;
		color: inherit;
		text-decoration: none;
	}

	.logo-text {
		display: inline-block;
	}

	.main-nav ul {
		display: flex;
		list-style: none;
		gap: 1.5rem;
		margin: 0;
		padding: 0;
	}

	.nav-link {
		color: #6b7280;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.nav-link:hover {
		color: var(--primary-color);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon-btn {
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		transition: all 0.2s;
	}

	.icon-btn:hover {
		background: #f3f4f6;
		color: #1f2937;
	}

	.dark-mode .icon-btn:hover {
		background: #374151;
		color: #f9fafb;
	}

	/* 메인 콘텐츠 */
	.site-main {
		flex: 1;
		padding: 2rem 0;
	}

	.time-filter-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		background: #ffffff;
		padding: 0.75rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.dark-mode .time-filter-tabs {
		background: #1f2937;
	}

	.time-tab {
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.time-tab:hover {
		background: #f3f4f6;
		color: #1f2937;
	}

	.time-tab.active {
		background: #1f2937;
		color: #ffffff;
	}

	.dark-mode .time-tab.active {
		background: #3b82f6;
	}

	.content-wrapper {
		background: #ffffff;
		border-radius: 0.5rem;
		padding: 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.dark-mode .content-wrapper {
		background: #1f2937;
	}

	/* 푸터 */
	.site-footer {
		background: #1f2937;
		color: #d1d5db;
		padding: 3rem 0 2rem;
		margin-top: auto;
	}

	.footer-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.footer-col h3 {
		color: #f9fafb;
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.footer-col ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.footer-col li {
		margin-bottom: 0.5rem;
	}

	.footer-col a {
		color: #9ca3af;
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s;
	}

	.footer-col a:hover {
		color: #3b82f6;
	}

	.footer-bottom {
		border-top: 1px solid #374151;
		padding-top: 1.5rem;
		text-align: center;
	}

	.copyright,
	.contact {
		margin: 0.5rem 0;
		font-size: 0.875rem;
		color: #9ca3af;
	}

	/* 반응형 */
	@media (max-width: 768px) {
		.header-inner {
			flex-wrap: wrap;
		}

		.main-nav {
			order: 3;
			width: 100%;
		}

		.main-nav ul {
			justify-content: center;
		}

		.time-filter-tabs {
			overflow-x: auto;
			flex-wrap: nowrap;
		}

		.content-wrapper {
			padding: 1rem;
		}

		.footer-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
