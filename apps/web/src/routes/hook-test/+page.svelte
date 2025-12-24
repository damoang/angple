<script lang="ts">
	import { hooks } from '@angple/hook-system';
	import { onMount } from 'svelte';

	let actionLog = $state<string[]>([]);
	let filterResult = $state<string>('');
	let numberFilterResult = $state<number>(0);

	onMount(() => {
		console.log('🧪 Hook 시스템 테스트 시작');

		// Action 테스트 - 우선순위 순서대로 실행
		hooks.addAction('test_action', () => {
			const msg = '✅ Action 1 실행 (priority: 10)';
			console.log(msg);
			actionLog.push(msg);
		}, 10);

		hooks.addAction('test_action', () => {
			const msg = '✅ Action 2 실행 (priority: 20)';
			console.log(msg);
			actionLog.push(msg);
		}, 20);

		hooks.addAction('test_action', () => {
			const msg = '✅ Action 3 실행 (priority: 5)';
			console.log(msg);
			actionLog.push(msg);
		}, 5);

		// Filter 테스트 - 문자열 변환
		hooks.addFilter('title_filter', (title: string) => {
			console.log('🔄 Filter 1: 접두사 추가');
			return `[Angple] ${title}`;
		}, 10);

		hooks.addFilter('title_filter', (title: string) => {
			console.log('🔄 Filter 2: 대문자 변환');
			return title.toUpperCase();
		}, 20);

		// Filter 테스트 - 숫자 연산
		hooks.addFilter('number_filter', (value: number) => value * 2, 5);
		hooks.addFilter('number_filter', (value: number) => value + 10, 10);
		hooks.addFilter('number_filter', (value: number) => value - 3, 15);
	});

	function testAction() {
		actionLog = [];
		hooks.doAction('test_action');
		console.log('📋 등록된 Hooks:', hooks.getRegisteredHooks());
	}

	function testFilter() {
		const originalTitle = '다모앙';
		filterResult = hooks.applyFilters('title_filter', originalTitle);
		console.log(`📝 필터 적용: "${originalTitle}" → "${filterResult}"`);
	}

	function testNumberFilter() {
		const originalNumber = 5;
		numberFilterResult = hooks.applyFilters('number_filter', originalNumber);
		console.log(`🔢 숫자 필터 적용: ${originalNumber} → ${numberFilterResult}`);
		console.log('계산 과정: 5 * 2 = 10 (priority 5) → 10 + 10 = 20 (priority 10) → 20 - 3 = 17 (priority 15)');
	}
</script>

<div class="container mx-auto max-w-4xl p-8">
	<h1 class="mb-8 text-4xl font-bold">🎯 Hook 시스템 테스트</h1>

	<!-- Action 테스트 -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">Action 테스트</h2>
		<p class="mb-4 text-gray-600">
			Action은 특정 시점에 콜백을 실행합니다. 우선순위 순서대로 실행됩니다.
		</p>

		<button
			onclick={testAction}
			class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>
			Action 실행 (test_action)
		</button>

		{#if actionLog.length > 0}
			<div class="mt-4 rounded-md bg-gray-100 p-4">
				<h3 class="mb-2 font-semibold">실행 결과:</h3>
				<ul class="space-y-1">
					{#each actionLog as log}
						<li class="font-mono text-sm">{log}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<!-- Filter 테스트 (문자열) -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">Filter 테스트 (문자열)</h2>
		<p class="mb-4 text-gray-600">
			Filter는 값을 변환합니다. 우선순위 순서대로 체인됩니다.
		</p>

		<button
			onclick={testFilter}
			class="rounded-md bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
		>
			Filter 적용 (title_filter)
		</button>

		{#if filterResult}
			<div class="mt-4 rounded-md bg-gray-100 p-4">
				<h3 class="mb-2 font-semibold">변환 결과:</h3>
				<p class="font-mono text-lg font-bold text-green-700">{filterResult}</p>
				<p class="mt-2 text-sm text-gray-600">
					원본: "다모앙" → "[Angple] 다모앙" → "[ANGPLE] 다모앙"
				</p>
			</div>
		{/if}
	</div>

	<!-- Filter 테스트 (숫자) -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">Filter 테스트 (숫자 연산)</h2>
		<p class="mb-4 text-gray-600">
			여러 필터를 체인하여 복잡한 변환을 수행할 수 있습니다.
		</p>

		<button
			onclick={testNumberFilter}
			class="rounded-md bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
		>
			숫자 Filter 적용 (number_filter)
		</button>

		{#if numberFilterResult > 0}
			<div class="mt-4 rounded-md bg-gray-100 p-4">
				<h3 class="mb-2 font-semibold">연산 결과:</h3>
				<p class="font-mono text-lg font-bold text-purple-700">{numberFilterResult}</p>
				<div class="mt-2 text-sm text-gray-600">
					<p class="font-semibold">계산 과정:</p>
					<ol class="ml-4 mt-1 list-decimal">
						<li>5 × 2 = 10 (priority 5)</li>
						<li>10 + 10 = 20 (priority 10)</li>
						<li>20 - 3 = 17 (priority 15)</li>
					</ol>
				</div>
			</div>
		{/if}
	</div>

	<!-- Hook 정보 -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-2xl font-semibold">등록된 Hook 정보</h2>
		<button
			onclick={() => {
				const registered = hooks.getRegisteredHooks();
				console.log('📋 등록된 Hooks:', registered);
				alert(`Actions: ${registered.actions.length}개\nFilters: ${registered.filters.length}개\n\n콘솔을 확인하세요!`);
			}}
			class="rounded-md bg-gray-600 px-4 py-2 text-white transition hover:bg-gray-700"
		>
			Hook 정보 보기
		</button>
	</div>

	<!-- 사용 예제 코드 -->
	<div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
		<h2 class="mb-4 text-2xl font-semibold">사용 예제</h2>
		<pre class="overflow-x-auto rounded-md bg-gray-900 p-4 text-sm text-white"><code>{`import { hooks } from '@angple/hook-system';

// Action 등록
hooks.addAction('page_loaded', () => {
  console.log('페이지 로드됨!');
}, 10);

// Action 실행
hooks.doAction('page_loaded');

// Filter 등록
hooks.addFilter('post_title', (title: string) => {
  return \`[공지] \${title}\`;
}, 10);

// Filter 적용
const title = hooks.applyFilters('post_title', '다모앙');
// 결과: "[공지] 다모앙"`}</code></pre>
	</div>
</div>
