<script lang="ts">
    import { apiClient } from '$lib/api';
    import { authActions } from '$lib/stores/auth.svelte.js';

    let testResults = $state<string[]>([]);
    let loading = $state(false);

    function addResult(message: string) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        testResults = [...testResults, `[${timeStr}] ${message}`];
    }

    async function testHealth() {
        loading = true;
        addResult('🔍 Health Check 테스트 시작...');
        try {
            const response = await fetch('http://localhost:8081/health');
            const data = await response.json();
            addResult(`✅ Health Check 성공: ${JSON.stringify(data)}`);
        } catch (error) {
            addResult(`❌ Health Check 실패: ${error}`);
        }
        loading = false;
    }

    async function testMenus() {
        loading = true;
        addResult('🔍 메뉴 API 테스트 시작...');
        try {
            const menus = await apiClient.getMenus();
            addResult(`✅ 메뉴 API 성공: ${menus.length}개 메뉴 조회`);
            addResult(`   첫 번째 메뉴: ${menus[0]?.title}`);
        } catch (error) {
            addResult(`❌ 메뉴 API 실패: ${error}`);
        }
        loading = false;
    }

    async function testCurrentUser() {
        loading = true;
        addResult('🔍 현재 사용자 조회 테스트 시작...');
        try {
            const user = await apiClient.getCurrentUser();
            if (user) {
                addResult(`✅ 사용자 조회 성공: ${user.mb_name} (${user.mb_id})`);
            } else {
                addResult('ℹ️ 비로그인 상태');
            }
        } catch (error) {
            addResult(`❌ 사용자 조회 실패: ${error}`);
        }
        loading = false;
    }

    async function testMockMode() {
        addResult(`ℹ️ Mock 모드: OFF (실제 API 호출)`);
        // Access Token은 localStorage에 저장됨
        const hasToken = !!localStorage.getItem('access_token');
        addResult(`ℹ️ Access Token: ${hasToken ? '있음' : '없음'}`);
    }

    function clearResults() {
        testResults = [];
    }
</script>

<div class="container mx-auto p-8">
    <h1 class="mb-8 text-3xl font-bold">Backend API 연동 테스트</h1>

    <div class="mb-8 grid grid-cols-2 gap-4">
        <button
            onclick={testHealth}
            disabled={loading}
            class="rounded bg-blue-500 px-6 py-3 text-white hover:bg-blue-600 disabled:opacity-50"
        >
            Health Check 테스트
        </button>

        <button
            onclick={testMenus}
            disabled={loading}
            class="rounded bg-green-500 px-6 py-3 text-white hover:bg-green-600 disabled:opacity-50"
        >
            메뉴 API 테스트
        </button>

        <button
            onclick={testCurrentUser}
            disabled={loading}
            class="rounded bg-purple-500 px-6 py-3 text-white hover:bg-purple-600 disabled:opacity-50"
        >
            현재 사용자 조회
        </button>

        <button
            onclick={testMockMode}
            disabled={loading}
            class="rounded bg-yellow-500 px-6 py-3 text-white hover:bg-yellow-600 disabled:opacity-50"
        >
            상태 확인
        </button>

        <button
            onclick={clearResults}
            class="col-span-2 rounded bg-gray-500 px-6 py-3 text-white hover:bg-gray-600"
        >
            결과 초기화
        </button>
    </div>

    <div class="h-96 overflow-y-auto rounded-lg bg-gray-900 p-6 font-mono text-sm text-green-400">
        <h2 class="mb-4 text-xl font-bold text-white">테스트 결과:</h2>
        {#if testResults.length === 0}
            <p class="text-gray-500">위 버튼을 클릭하여 테스트를 시작하세요...</p>
        {:else}
            {#each testResults as result}
                <div class="mb-2">{result}</div>
            {/each}
        {/if}
    </div>

    <div class="mt-8 rounded-lg bg-blue-50 p-4">
        <h3 class="mb-2 font-bold">현재 설정:</h3>
        <ul class="list-inside list-disc text-sm">
            <li>
                Backend URL: <code class="rounded bg-gray-200 px-2 py-1"
                    >http://localhost:8081/api/v2</code
                >
            </li>
            <li>
                Mock Mode: <code class="rounded bg-gray-200 px-2 py-1">OFF (실제 API 호출)</code>
            </li>
            <li>
                브라우저 테스트 페이지: <code class="rounded bg-gray-200 px-2 py-1"
                    >http://localhost:5173/api-test</code
                >
            </li>
        </ul>
    </div>
</div>
