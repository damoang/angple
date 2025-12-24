<script lang="ts">
	import { onMount } from 'svelte';
	import { themeManager } from '@angple/theme-engine';
	import { hooks } from '@angple/hook-system';
	import type { ActiveTheme } from '@angple/types';

	let activeTheme = $state<ActiveTheme | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let filterTestResult = $state<string>('');

	onMount(() => {
		// 현재 활성화된 테마 확인
		activeTheme = themeManager.getActiveTheme();
	});

	async function activateTheme() {
		isLoading = true;
		error = null;

		try {
			await themeManager.activateTheme('sample-theme');
			activeTheme = themeManager.getActiveTheme();
			console.log('✅ 테마 활성화 성공:', activeTheme);
		} catch (err) {
			error = err instanceof Error ? err.message : '테마 활성화 실패';
			console.error('❌ 테마 활성화 실패:', err);
		} finally {
			isLoading = false;
		}
	}

	async function deactivateTheme() {
		isLoading = true;
		error = null;

		try {
			await themeManager.deactivateTheme();
			activeTheme = null;
			console.log('✅ 테마 비활성화 성공');
		} catch (err) {
			error = err instanceof Error ? err.message : '테마 비활성화 실패';
			console.error('❌ 테마 비활성화 실패:', err);
		} finally {
			isLoading = false;
		}
	}

	function testPageLoadedAction() {
		console.log('🎯 page_loaded Action Hook 실행 중...');
		hooks.doAction('page_loaded');
	}

	function testPostTitleFilter() {
		const originalTitle = '다모앙 테스트 게시물';
		const filteredTitle = hooks.applyFilters('post_title', originalTitle);
		filterTestResult = filteredTitle;
		console.log(`🎯 post_title Filter Hook 적용: "${originalTitle}" → "${filteredTitle}"`);
	}
</script>

<div class="container mx-auto max-w-4xl p-8">
	<h1 class="mb-8 text-4xl font-bold">🎨 Theme System 테스트</h1>

	{#if error}
		<div class="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
			<p class="font-semibold">오류 발생:</p>
			<p>{error}</p>
		</div>
	{/if}

	<!-- 테마 활성화/비활성화 -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">테마 관리</h2>

		<div class="mb-4 flex gap-4">
			<button
				onclick={activateTheme}
				disabled={isLoading || activeTheme !== null}
				class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? '로딩 중...' : 'Sample Theme 활성화'}
			</button>

			<button
				onclick={deactivateTheme}
				disabled={isLoading || activeTheme === null}
				class="rounded-md bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? '로딩 중...' : '테마 비활성화'}
			</button>
		</div>

		{#if activeTheme}
			<div class="rounded-md bg-green-50 p-4">
				<h3 class="mb-2 font-semibold text-green-900">✅ 활성화된 테마:</h3>
				<div class="space-y-1 text-sm text-green-700">
					<p><strong>이름:</strong> {activeTheme.manifest.name}</p>
					<p><strong>버전:</strong> {activeTheme.manifest.version}</p>
					<p><strong>설명:</strong> {activeTheme.manifest.description}</p>
					<p><strong>작성자:</strong> {activeTheme.manifest.author.name}</p>
					<p>
						<strong>Hook 개수:</strong>
						{activeTheme.manifest.hooks?.length || 0}
					</p>
					<p>
						<strong>컴포넌트 개수:</strong>
						{activeTheme.manifest.components?.length || 0}
					</p>
				</div>
			</div>
		{:else}
			<div class="rounded-md bg-gray-100 p-4 text-gray-600">
				<p>현재 활성화된 테마가 없습니다.</p>
			</div>
		{/if}
	</div>

	<!-- Hook 테스트 -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">Hook 테스트</h2>

		<div class="space-y-4">
			<!-- Action Hook 테스트 -->
			<div>
				<h3 class="mb-2 font-semibold">Action Hook: page_loaded</h3>
				<button
					onclick={testPageLoadedAction}
					class="rounded-md bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
				>
					page_loaded 실행
				</button>
				<p class="mt-2 text-sm text-gray-600">
					테마가 활성화되어 있으면 콘솔에 테마의 메시지가 출력됩니다.
				</p>
			</div>

			<!-- Filter Hook 테스트 -->
			<div>
				<h3 class="mb-2 font-semibold">Filter Hook: post_title</h3>
				<button
					onclick={testPostTitleFilter}
					class="rounded-md bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
				>
					post_title 필터 적용
				</button>

				{#if filterTestResult}
					<div class="mt-2 rounded-md bg-gray-100 p-3">
						<p class="text-sm text-gray-600">변환 결과:</p>
						<p class="font-mono font-semibold text-green-700">{filterTestResult}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- 등록된 Hook 정보 -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">등록된 Hook 정보</h2>
		<button
			onclick={() => {
				const registered = hooks.getRegisteredHooks();
				console.log('📋 등록된 Hooks:', registered);
				alert(
					`Actions: ${registered.actions.length}개\nFilters: ${registered.filters.length}개\n\n콘솔을 확인하세요!`
				);
			}}
			class="rounded-md bg-gray-600 px-4 py-2 text-white transition hover:bg-gray-700"
		>
			Hook 정보 보기
		</button>
	</div>

	<!-- 사용 가이드 -->
	<div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
		<h2 class="mb-4 text-2xl font-semibold">사용 가이드</h2>
		<div class="space-y-4 text-sm text-gray-700">
			<div>
				<h3 class="mb-2 font-semibold">1. 테마 활성화</h3>
				<p>"Sample Theme 활성화" 버튼을 클릭하면 테마가 로드됩니다.</p>
			</div>
			<div>
				<h3 class="mb-2 font-semibold">2. Hook 실행 확인</h3>
				<p>테마 활성화 후 Hook 테스트 버튼들을 클릭해보세요.</p>
				<p>브라우저 개발자 도구 콘솔(F12)에서 결과를 확인할 수 있습니다.</p>
			</div>
			<div>
				<h3 class="mb-2 font-semibold">3. 테마 구조</h3>
				<p>테마 파일은 <code class="rounded bg-gray-200 px-1">/static/themes/sample-theme/</code>에 있습니다.</p>
				<ul class="ml-4 mt-1 list-disc">
					<li>theme.json - 테마 메타데이터</li>
					<li>hooks/ - Hook 콜백 함수</li>
					<li>components/ - Svelte 컴포넌트</li>
				</ul>
			</div>
		</div>
	</div>
</div>
