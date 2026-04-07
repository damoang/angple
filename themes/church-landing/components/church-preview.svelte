<script lang="ts">
    /**
     * 교회 SaaS 실시간 미리보기
     * URL 파라미터에서 테마 + 교회 데이터를 읽어 렌더링
     */
    import { page } from '$app/stores';
    import { browser } from '$app/environment';

    // URL에서 테마와 데이터 파싱
    const themeId = $derived($page.url.searchParams.get('theme') || 'church-grace');

    let churchData = $state({
        name: '우리교회',
        nameEn: 'Our Church',
        slogan: '하나님의 사랑으로 하나되는 공동체',
        primaryColor: '#7C3AED',
        sundayService: '오전 11:00',
        wednesdayService: '오후 7:30',
        morningPrayer: '오전 5:30',
        fridayPrayer: '오후 8:00',
        pastorName: '',
        pastorTitle: '담임목사',
        pastorBio: '',
        address: '',
        phone: '',
        email: '',
    });

    // postMessage로 부모에서 데이터 수신
    $effect(() => {
        if (!browser) return;

        function handleMessage(e: MessageEvent) {
            if (e.data?.type === 'church-preview-update') {
                churchData = { ...churchData, ...e.data.data };
            }
        }
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    });

    // 테마별 색상
    const themeColors: Record<string, { primary: string; gradient: string; bg: string }> = {
        'church-grace': { primary: '#8B4513', gradient: 'from-[#8B4513] to-[#D4A574]', bg: '#FDFBF7' },
        'church-modern': { primary: '#1E293B', gradient: 'from-[#0F172A] to-[#3B82F6]', bg: '#FFFFFF' },
        'church-light': { primary: '#92400E', gradient: 'from-[#F59E0B] to-[#FBBF24]', bg: '#FFFFFF' },
        'church-nature': { primary: '#064E3B', gradient: 'from-[#059669] to-[#34D399]', bg: '#F0FDF4' },
        'church-royal': { primary: '#4C1D95', gradient: 'from-[#7C3AED] to-[#A78BFA]', bg: '#FAF5FF' },
        'church-ocean': { primary: '#0C4A6E', gradient: 'from-[#0284C7] to-[#38BDF8]', bg: '#F0F9FF' },
        'church-warm': { primary: '#9A3412', gradient: 'from-[#EA580C] to-[#FB923C]', bg: '#FFF7ED' },
        'church-classic': { primary: '#991B1B', gradient: 'from-[#991B1B] to-[#B91C1C]', bg: '#FEF2F2' },
        'church-youth': { primary: '#831843', gradient: 'from-[#EC4899] to-[#A855F7]', bg: '#FDF2F8' },
        'church-simple': { primary: '#334155', gradient: 'from-[#475569] to-[#94A3B8]', bg: '#F8FAFC' },
    };

    const colors = $derived(themeColors[themeId] || themeColors['church-grace']);
    const displayName = $derived(churchData.name || '우리교회');
</script>

<div class="min-h-screen" style="background: {colors.bg};">
    <!-- Header -->
    <header class="border-b bg-white/95 backdrop-blur">
        <div class="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
            <div class="flex items-center gap-2">
                <span class="text-lg">✝️</span>
                <span class="text-sm font-bold" style="color: {colors.primary};">{displayName}</span>
            </div>
            <nav class="flex items-center gap-3 text-xs text-gray-500">
                <span>홈</span><span>설교</span><span>소개</span><span>공지</span>
            </nav>
        </div>
    </header>

    <!-- Hero -->
    <section class="bg-gradient-to-br {colors.gradient} py-16 text-center text-white">
        <div class="mx-auto max-w-2xl px-4">
            <div class="mb-3 text-4xl">✝️</div>
            <h1 class="mb-3 text-3xl font-bold">{displayName}</h1>
            {#if churchData.slogan}
                <p class="text-sm opacity-90">{churchData.slogan}</p>
            {/if}
            {#if churchData.nameEn}
                <p class="mt-1 text-xs opacity-60">{churchData.nameEn}</p>
            {/if}
        </div>
    </section>

    <!-- 예배 시간 -->
    <section class="py-10">
        <div class="mx-auto max-w-4xl px-4">
            <h2 class="mb-6 text-center text-xl font-bold" style="color: {colors.primary};">예배 안내</h2>
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {#each [
                    ['🙏', '주일예배', churchData.sundayService],
                    ['📖', '수요예배', churchData.wednesdayService],
                    ['🌅', '새벽기도', churchData.morningPrayer],
                    ['🌙', '금요기도', churchData.fridayPrayer],
                ] as [icon, title, time]}
                    {#if time}
                        <div class="rounded-lg border bg-white p-4 text-center shadow-sm">
                            <div class="mb-1 text-2xl">{icon}</div>
                            <h3 class="text-sm font-bold" style="color: {colors.primary};">{title}</h3>
                            <p class="text-xs text-gray-500">{time}</p>
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </section>

    <!-- 목사님 소개 -->
    {#if churchData.pastorName}
        <section class="border-t py-10">
            <div class="mx-auto max-w-2xl px-4 text-center">
                <h2 class="mb-6 text-xl font-bold" style="color: {colors.primary};">목사님 소개</h2>
                <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl" style="background: linear-gradient(135deg, {colors.primary}20, {colors.primary}40);">
                    👤
                </div>
                <h3 class="mt-3 text-lg font-bold">{churchData.pastorName}</h3>
                <p class="text-sm text-gray-500">{churchData.pastorTitle}</p>
                {#if churchData.pastorBio}
                    <p class="mt-3 text-sm text-gray-600">{churchData.pastorBio}</p>
                {/if}
            </div>
        </section>
    {/if}

    <!-- 오시는 길 -->
    {#if churchData.address || churchData.phone}
        <section class="border-t py-10">
            <div class="mx-auto max-w-2xl px-4 text-center">
                <h2 class="mb-4 text-xl font-bold" style="color: {colors.primary};">오시는 길</h2>
                {#if churchData.address}<p class="text-sm text-gray-600">📍 {churchData.address}</p>{/if}
                {#if churchData.phone}<p class="text-sm text-gray-600">📞 {churchData.phone}</p>{/if}
                {#if churchData.email}<p class="text-sm text-gray-600">✉️ {churchData.email}</p>{/if}
            </div>
        </section>
    {/if}

    <!-- Footer -->
    <footer class="py-6 text-center" style="background: {colors.primary}; color: white;">
        <p class="text-sm font-bold">{displayName}</p>
        {#if churchData.address}<p class="text-xs opacity-70">{churchData.address}</p>{/if}
        <p class="mt-2 text-xs opacity-40">Powered by church.re.kr</p>
    </footer>
</div>
