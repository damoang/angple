<script lang="ts">
    /**
     * 교회 SaaS 커스터마이징 위저드
     * 4단계: 기본정보 → 예배안내 → 목사님 → 오시는길
     * 좌측 폼(40%) + 우측 미리보기(60%)
     */
    import { page } from '$app/stores';
    import { browser } from '$app/environment';

    // 선택된 테마
    const themeId = $derived($page.url.searchParams.get('theme') || 'church-grace');

    // 현재 Step
    let currentStep = $state(1);
    const totalSteps = 4;

    // 모바일 미리보기 토글
    let showPreview = $state(false);

    // 폼 데이터
    let churchData = $state({
        // Step 1: 기본 정보
        name: '',
        nameEn: '',
        slogan: '',
        primaryColor: '#7C3AED',

        // Step 2: 예배 안내
        sundayService: '오전 11:00',
        wednesdayService: '오후 7:30',
        morningPrayer: '오전 5:30',
        fridayPrayer: '오후 8:00',

        // Step 3: 목사님
        pastorName: '',
        pastorTitle: '담임목사',
        pastorBio: '',

        // Step 4: 오시는 길
        address: '',
        phone: '',
        email: '',
        mapUrl: '',
    });

    // 미리보기 URL 생성
    let previewUrl = $derived(() => {
        if (!browser) return '';
        const data = btoa(encodeURIComponent(JSON.stringify(churchData)));
        return `/preview?theme=${themeId}&data=${data}`;
    });

    // 미리보기 iframe에 postMessage 전달
    let previewIframe: HTMLIFrameElement;
    let debounceTimer: ReturnType<typeof setTimeout>;

    function sendToPreview() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            previewIframe?.contentWindow?.postMessage(
                { type: 'church-preview-update', data: churchData },
                '*'
            );
        }, 300);
    }

    $effect(() => {
        JSON.stringify(churchData);
        sendToPreview();
    });

    const steps = [
        { num: 1, title: '기본 정보', icon: '⛪' },
        { num: 2, title: '예배 안내', icon: '🙏' },
        { num: 3, title: '목사님 소개', icon: '👤' },
        { num: 4, title: '오시는 길', icon: '📍' },
    ];

    function nextStep() { if (currentStep < totalSteps) currentStep++; }
    function prevStep() { if (currentStep > 1) currentStep--; }

    function handleSubmit() {
        // 데이터를 localStorage에 저장하고 signup 페이지로 이동
        if (browser) {
            localStorage.setItem('church_customize_data', JSON.stringify({ theme: themeId, ...churchData }));
            window.location.href = '/signup';
        }
    }
</script>

<div class="flex min-h-screen flex-col bg-gray-50">
    <!-- Header -->
    <header class="border-b bg-white">
        <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <a href="/" class="flex items-center gap-2">
                <span class="text-xl">⛪</span>
                <span class="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-lg font-bold text-transparent">church.re.kr</span>
            </a>
            <div class="flex items-center gap-3">
                <!-- 모바일 미리보기 토글 -->
                <button class="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 lg:hidden" onclick={() => showPreview = !showPreview}>
                    {showPreview ? '폼 보기' : '미리보기 👁️'}
                </button>
                <a href="/" class="text-sm text-gray-500 hover:text-gray-700">← 돌아가기</a>
            </div>
        </div>
    </header>

    <!-- 프로그레스 바 -->
    <div class="border-b bg-white px-4 py-3">
        <div class="mx-auto max-w-7xl">
            <div class="flex items-center justify-between">
                {#each steps as step}
                    <button
                        class="flex items-center gap-2 text-sm transition {currentStep === step.num ? 'font-bold text-violet-600' : currentStep > step.num ? 'text-green-600' : 'text-gray-400'}"
                        onclick={() => currentStep = step.num}
                    >
                        <div class="flex h-8 w-8 items-center justify-center rounded-full text-xs transition
                            {currentStep === step.num ? 'bg-violet-600 text-white' : currentStep > step.num ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}">
                            {currentStep > step.num ? '✓' : step.num}
                        </div>
                        <span class="hidden sm:inline">{step.title}</span>
                    </button>
                    {#if step.num < totalSteps}
                        <div class="mx-2 h-px flex-1 {currentStep > step.num ? 'bg-green-300' : 'bg-gray-200'}"></div>
                    {/if}
                {/each}
            </div>
        </div>
    </div>

    <!-- 메인: 좌우 분할 -->
    <div class="flex flex-1">
        <!-- 좌측: 폼 (모바일에서는 미리보기 토글 시 숨김) -->
        <div class="w-full overflow-y-auto border-r bg-white p-6 lg:w-[40%] {showPreview ? 'hidden lg:block' : ''}">
            <div class="mx-auto max-w-md">
                <!-- Step 1: 기본 정보 -->
                {#if currentStep === 1}
                    <div>
                        <h2 class="mb-1 text-xl font-bold text-gray-900">⛪ 기본 정보</h2>
                        <p class="mb-6 text-sm text-gray-500">교회의 기본 정보를 입력해주세요</p>

                        <div class="space-y-4">
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">교회 이름 <span class="text-red-500">*</span></label>
                                <input type="text" bind:value={churchData.name} placeholder="예: 은혜의 교회" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">영문 이름</label>
                                <input type="text" bind:value={churchData.nameEn} placeholder="예: Grace Church" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">슬로건</label>
                                <input type="text" bind:value={churchData.slogan} placeholder="예: 하나님의 사랑으로 하나되는 공동체" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">대표 색상</label>
                                <div class="flex items-center gap-3">
                                    <input type="color" bind:value={churchData.primaryColor} class="h-10 w-14 cursor-pointer rounded border" />
                                    <span class="text-sm text-gray-400">{churchData.primaryColor}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Step 2: 예배 안내 -->
                {#if currentStep === 2}
                    <div>
                        <h2 class="mb-1 text-xl font-bold text-gray-900">🙏 예배 안내</h2>
                        <p class="mb-6 text-sm text-gray-500">예배 시간을 입력해주세요 (선택 항목은 비워두셔도 됩니다)</p>

                        <div class="space-y-4">
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">주일예배 <span class="text-red-500">*</span></label>
                                <input type="text" bind:value={churchData.sundayService} placeholder="오전 11:00" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">수요예배</label>
                                <input type="text" bind:value={churchData.wednesdayService} placeholder="오후 7:30" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">새벽기도</label>
                                <input type="text" bind:value={churchData.morningPrayer} placeholder="오전 5:30" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">금요기도</label>
                                <input type="text" bind:value={churchData.fridayPrayer} placeholder="오후 8:00" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Step 3: 목사님 소개 -->
                {#if currentStep === 3}
                    <div>
                        <h2 class="mb-1 text-xl font-bold text-gray-900">👤 목사님 소개</h2>
                        <p class="mb-6 text-sm text-gray-500">담임목사님 정보를 입력해주세요</p>

                        <div class="space-y-4">
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">이름 <span class="text-red-500">*</span></label>
                                <input type="text" bind:value={churchData.pastorName} placeholder="홍길동" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">직위</label>
                                <input type="text" bind:value={churchData.pastorTitle} placeholder="담임목사" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">소개</label>
                                <textarea bind:value={churchData.pastorBio} placeholder="약력, 인사말 등을 자유롭게 입력해주세요" rows="4" class="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"></textarea>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Step 4: 오시는 길 -->
                {#if currentStep === 4}
                    <div>
                        <h2 class="mb-1 text-xl font-bold text-gray-900">📍 오시는 길</h2>
                        <p class="mb-6 text-sm text-gray-500">교회 위치와 연락처를 입력해주세요</p>

                        <div class="space-y-4">
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">주소 <span class="text-red-500">*</span></label>
                                <input type="text" bind:value={churchData.address} placeholder="서울특별시 OO구 OO로 123" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">전화번호 <span class="text-red-500">*</span></label>
                                <input type="tel" bind:value={churchData.phone} placeholder="02-1234-5678" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700">이메일</label>
                                <input type="email" bind:value={churchData.email} placeholder="info@church.re.kr" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- 하단 버튼 -->
                <div class="mt-8 flex items-center justify-between">
                    {#if currentStep > 1}
                        <button onclick={prevStep} class="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50">← 이전</button>
                    {:else}
                        <div></div>
                    {/if}

                    {#if currentStep < totalSteps}
                        <button onclick={nextStep} class="rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90">다음 →</button>
                    {:else}
                        <button onclick={handleSubmit} class="rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 hover:shadow-xl">
                            ✨ 이대로 시작하기
                        </button>
                    {/if}
                </div>

                <!-- 현재 테마 표시 -->
                <div class="mt-6 rounded-lg bg-violet-50 p-3 text-center">
                    <p class="text-xs text-violet-600">선택된 테마: <strong>{themeId.replace('church-', '')}</strong></p>
                    <a href="/" class="text-xs text-violet-400 hover:text-violet-600">다른 테마 선택 →</a>
                </div>
            </div>
        </div>

        <!-- 우측: 실시간 미리보기 -->
        <div class="hidden flex-1 bg-gray-100 lg:block {showPreview ? '!block' : ''}">
            <div class="sticky top-0 flex h-[calc(100vh-110px)] flex-col">
                <div class="flex items-center justify-between border-b bg-white px-4 py-2">
                    <span class="text-xs font-medium text-gray-500">실시간 미리보기</span>
                    <div class="flex items-center gap-2">
                        <div class="h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
                        <span class="text-xs text-green-600">실시간 반영</span>
                    </div>
                </div>
                <div class="flex-1 overflow-hidden p-4">
                    <div class="h-full overflow-hidden rounded-lg border bg-white shadow-lg">
                        <iframe
                            bind:this={previewIframe}
                            src="/preview?theme={themeId}"
                            title="미리보기"
                            class="h-full w-full"
                            style="transform: scale(0.75); transform-origin: top left; width: 133%; height: 133%;"
                            onload={sendToPreview}
                        ></iframe>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
