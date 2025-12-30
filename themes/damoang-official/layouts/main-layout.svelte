<script lang="ts">
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import OfficialHeader from '../components/official-header.svelte';
    import OfficialFooter from '../components/official-footer.svelte';
    import RightWidget from '../components/right-widget.svelte';
    import { getComponentsForSlot } from '$lib/components/slot-manager';

    /**
     * Damoang Official 2025 Theme
     * - 모던하고 세련된 3단 레이아웃
     * - 보라색/핑크 브랜드 색상
     * - 실시간 트렌드 위젯
     * - Fixed 헤더 옵션
     */

    const { children } = $props();

    onMount(() => {
        console.log('🎨 Damoang Official 2025 Theme 레이아웃 마운트됨');
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>다모앙 - 함께 모이는 즐거움</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <meta name="description" content="다모앙 - 대한민국 대표 커뮤니티 플랫폼" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-gradient-to-br from-purple-50 via-white to-pink-50">
    <!-- Header -->
    <OfficialHeader />

    <!-- Slot: header-after (공지 배너 등) -->
    {#each getComponentsForSlot('header-after') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- Main Content Area - 3단 레이아웃 -->
    <div class="container mx-auto flex flex-1 gap-6 px-4 py-6">
        <!-- Left Sidebar - 네비게이션 -->
        <aside class="hidden w-56 flex-shrink-0 lg:block">
            <div class="sticky top-20 space-y-4">
                <!-- 메뉴 -->
                <div class="rounded-xl bg-white p-4 shadow-sm">
                    <h3 class="mb-3 text-sm font-bold text-gray-900">게시판</h3>
                    <nav class="space-y-1">
                        <a
                            href="/"
                            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700"
                        >
                            <span class="text-lg">🏠</span>
                            <span>홈</span>
                        </a>
                        <a
                            href="/free"
                            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700"
                        >
                            <span class="text-lg">💬</span>
                            <span>자유게시판</span>
                        </a>
                        <a
                            href="/notice"
                            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700"
                        >
                            <span class="text-lg">📢</span>
                            <span>공지사항</span>
                        </a>
                        <a
                            href="/qna"
                            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700"
                        >
                            <span class="text-lg">❓</span>
                            <span>Q&A</span>
                        </a>
                    </nav>
                </div>

                <!-- 실시간 접속자 -->
                <div
                    class="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-4 text-white shadow-sm"
                >
                    <h3 class="mb-2 text-sm font-bold">실시간 접속</h3>
                    <div class="flex items-baseline gap-1">
                        <span class="text-3xl font-bold">1,247</span>
                        <span class="text-sm opacity-90">명</span>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="min-w-0 flex-1">
            <!-- Slot: content-before (트렌딩 위젯 등) -->
            {#each getComponentsForSlot('content-before') as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}

            <div class="rounded-xl bg-white p-6 shadow-sm">
                {@render children()}
            </div>

            <!-- Slot: content-after -->
            {#each getComponentsForSlot('content-after') as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}
        </main>

        <!-- Right Widget Area -->
        <aside class="hidden w-80 flex-shrink-0 xl:block">
            <div class="sticky top-20">
                <RightWidget />
            </div>
        </aside>
    </div>

    <!-- Footer -->
    <OfficialFooter />
</div>
