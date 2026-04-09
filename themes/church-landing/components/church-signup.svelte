<script lang="ts">
    /**
     * 처치레(ChurchRe) 회원가입 + 사이트 생성
     * 이메일/이름 입력 → 서브도메인 선택 → 생성
     */
    import { browser } from '$app/environment';

    // localStorage에서 커스터마이징 데이터
    let customizeData = $state<any>(null);
    let subdomain = $state('');
    let subdomainStatus = $state<'idle' | 'checking' | 'available' | 'taken'>('idle');
    let isCreating = $state(false);
    let error = $state('');
    let success = $state(false);
    let createdUrl = $state('');

    // 사용자 정보 (직접 입력)
    let ownerName = $state('');
    let ownerEmail = $state('');

    $effect(() => {
        if (!browser) return;
        const saved = localStorage.getItem('church_customize_data');
        if (saved) {
            customizeData = JSON.parse(saved);
            // 커스터마이즈에서 입력한 교회명을 서브도메인 힌트로
            if (customizeData?.nameEn) {
                subdomain = customizeData.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '');
            }
        }
    });

    // 서브도메인 유효성 + 중복 체크
    let checkTimer: ReturnType<typeof setTimeout>;
    function checkSubdomain() {
        clearTimeout(checkTimer);
        const val = subdomain.trim().toLowerCase();
        if (!val || val.length < 3) { subdomainStatus = 'idle'; return; }
        if (!/^[a-z0-9-]+$/.test(val)) { subdomainStatus = 'idle'; error = '영문 소문자, 숫자, -만 가능합니다'; return; }
        error = '';
        subdomainStatus = 'checking';
        checkTimer = setTimeout(async () => {
            const r = await fetch(`/api/church/check-subdomain?subdomain=${val}`);
            const d = await r.json();
            subdomainStatus = d.available ? 'available' : 'taken';
        }, 500);
    }

    function isValidEmail(email: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    const canSubmit = $derived(
        ownerName.trim().length >= 2 &&
        isValidEmail(ownerEmail) &&
        subdomainStatus === 'available' &&
        !isCreating
    );

    async function createSite() {
        if (!canSubmit) return;

        isCreating = true; error = '';
        try {
            const r = await fetch('/api/church/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subdomain: subdomain.trim().toLowerCase(),
                    site_name: customizeData?.name || subdomain,
                    owner_email: ownerEmail.trim(),
                    owner_name: ownerName.trim(),
                    theme: customizeData?.theme || 'church-grace',
                    settings: customizeData || {},
                })
            });
            const d = await r.json();
            if (d.success) {
                success = true;
                createdUrl = `https://${subdomain}.church.re.kr`;
                localStorage.removeItem('church_customize_data');
            } else { error = typeof d.error === 'object' ? d.error.message : d.error; }
        } catch { error = '사이트 생성 중 오류가 발생했습니다'; }
        finally { isCreating = false; }
    }
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 to-blue-50 p-4">
    {#if success}
        <div class="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
            <div class="mb-4 text-6xl">🎉</div>
            <h1 class="mb-2 text-2xl font-bold text-gray-900">교회 홈페이지가 생성되었습니다!</h1>
            <p class="mb-6 text-gray-500">지금 바로 방문해보세요</p>
            <a href={createdUrl} class="mb-4 block rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:shadow-xl">
                {createdUrl.replace('https://', '')} 방문하기
            </a>
            <a href="/" class="text-sm text-gray-400 hover:text-gray-600">← 메인으로 돌아가기</a>
        </div>
    {:else}
        <div class="w-full max-w-md">
            <div class="mb-8 text-center">
                <a href="/" class="mb-4 inline-flex items-center gap-2">
                    <span class="text-3xl">⛪</span>
                    <span class="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-2xl font-bold text-transparent">처치레</span>
                </a>
                <h1 class="mt-4 text-2xl font-bold text-gray-900">교회 홈페이지 만들기</h1>
                <p class="mt-1 text-sm text-gray-500">3분이면 교회 홈페이지가 완성됩니다</p>
            </div>

            <div class="rounded-2xl bg-white p-8 shadow-xl">
                {#if customizeData}
                    <div class="mb-6 rounded-lg bg-violet-50 p-3">
                        <p class="text-xs text-violet-600">✨ 커스터마이징 완료: <strong>{customizeData.name || customizeData.theme}</strong></p>
                    </div>
                {/if}

                <!-- Step 1: 담당자 정보 -->
                <div class="mb-6">
                    <h2 class="mb-3 text-sm font-bold text-gray-700">1. 담당자 정보</h2>
                    <div class="space-y-3">
                        <input
                            type="text" bind:value={ownerName}
                            placeholder="이름 (예: 김목사)"
                            class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        />
                        <input
                            type="email" bind:value={ownerEmail}
                            placeholder="이메일 (예: pastor@gmail.com)"
                            class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        />
                    </div>
                </div>

                <!-- Step 2: 서브도메인 선택 -->
                <div class="mb-6">
                    <h2 class="mb-3 text-sm font-bold text-gray-700">2. 홈페이지 주소</h2>
                    <div class="flex items-center gap-0 rounded-lg border {subdomainStatus === 'available' ? 'border-green-300 ring-2 ring-green-100' : subdomainStatus === 'taken' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-300'} overflow-hidden">
                        <input
                            type="text" bind:value={subdomain} oninput={checkSubdomain}
                            placeholder="mychurch"
                            class="flex-1 px-4 py-3 text-sm outline-none"
                        />
                        <span class="whitespace-nowrap bg-gray-50 px-3 py-3 text-sm text-gray-400">.church.re.kr</span>
                    </div>
                    <div class="mt-1 h-5">
                        {#if subdomainStatus === 'checking'}
                            <p class="text-xs text-gray-400">확인 중...</p>
                        {:else if subdomainStatus === 'available'}
                            <p class="text-xs text-green-600">✅ 사용 가능합니다</p>
                        {:else if subdomainStatus === 'taken'}
                            <p class="text-xs text-red-500">이미 사용 중입니다</p>
                        {:else if subdomain.length > 0 && subdomain.length < 3}
                            <p class="text-xs text-gray-400">3자 이상 입력하세요</p>
                        {/if}
                    </div>
                </div>

                {#if error}
                    <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
                {/if}

                <button
                    onclick={createSite}
                    disabled={!canSubmit}
                    class="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 py-4 text-sm font-bold text-white shadow-lg transition hover:opacity-90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isCreating ? '생성 중...' : '✨ 교회 홈페이지 시작하기 (무료)'}
                </button>

                <p class="mt-4 text-center text-xs text-gray-400">
                    무료 체험 후 유료 전환 가능 · <a href="/terms" class="underline">이용약관</a>
                </p>
            </div>

            <div class="mt-6 text-center">
                <a href="/customize" class="text-sm text-violet-500 hover:text-violet-700">← 커스터마이즈로 돌아가기</a>
                <span class="mx-2 text-gray-300">|</span>
                <a href="/" class="text-sm text-gray-400 hover:text-gray-600">메인으로</a>
            </div>
        </div>
    {/if}
</div>
