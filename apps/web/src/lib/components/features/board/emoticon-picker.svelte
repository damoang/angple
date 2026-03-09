<script lang="ts">
    import { REACTION_EMOTICONS } from '$lib/config/reaction-config.js';

    interface Props {
        onInsertEmoticon: (text: string) => void;
        onClose: () => void;
    }

    let { onInsertEmoticon, onClose }: Props = $props();

    // 이모지 (유니코드) - 기존 리액션 설정에서 가져옴
    const emojis = REACTION_EMOTICONS.filter((e) => e.category === 'emoji');

    // 팩 데이터
    interface EmoticonItem {
        file: string;
        thumb: string | null;
    }
    interface EmoticonPack {
        name: string;
        prefix: string;
        count: number;
        items: EmoticonItem[];
    }

    let packs = $state<EmoticonPack[]>([]);
    let loading = $state(true);
    let error = $state(false);
    let activeTab = $state('pack-0');
    let activeTabIndex = $derived(
        activeTab === 'emoji'
            ? packs.length
            : activeTab.startsWith('pack-')
              ? parseInt(activeTab.split('-')[1])
              : 0
    );
    let activePack = $derived(
        activeTab.startsWith('pack-') ? packs[parseInt(activeTab.split('-')[1])] : null
    );

    // 탭 스크롤 상태 (좌우 페이드 힌트용)
    let tabContainer = $state<HTMLDivElement | null>(null);
    let canScrollLeft = $state(false);
    let canScrollRight = $state(false);

    function updateScrollHints() {
        if (!tabContainer) return;
        const { scrollLeft, scrollWidth, clientWidth } = tabContainer;
        canScrollLeft = scrollLeft > 4;
        canScrollRight = scrollLeft + clientWidth < scrollWidth - 4;
    }

    $effect(() => {
        if (!tabContainer || loading) return;
        // 초기 상태 + ResizeObserver
        updateScrollHints();
        const ro = new ResizeObserver(updateScrollHints);
        ro.observe(tabContainer);
        return () => ro.disconnect();
    });

    // 마운트 시 API 호출 (브라우저 HTTP 캐시로 2회차부터 즉시 응답)
    fetch('/api/emoticons/list')
        .then((res) => {
            if (!res.ok) throw new Error('API error');
            return res.json();
        })
        .then((data: { packs: EmoticonPack[] }) => {
            packs = data.packs;
            loading = false;
        })
        .catch(() => {
            error = true;
            loading = false;
        });

    function selectEmoticon(filename: string): void {
        onInsertEmoticon(`{emo:${filename}}`);
        onClose();
    }

    function selectEmoji(emoji: string): void {
        onInsertEmoticon(emoji);
        onClose();
    }

    function thumbUrl(item: EmoticonItem): string {
        return `/emoticons/${item.thumb || item.file}`;
    }

    function scrollActiveTabIntoView(index: number) {
        if (!tabContainer) return;
        const btn = tabContainer.children[index] as HTMLElement;
        if (!btn) return;
        const containerRect = tabContainer.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        if (btnRect.left < containerRect.left) {
            tabContainer.scrollLeft += btnRect.left - containerRect.left - 4;
        } else if (btnRect.right > containerRect.right) {
            tabContainer.scrollLeft += btnRect.right - containerRect.right + 4;
        }
    }

    function scrollTabs(direction: 'left' | 'right') {
        if (!tabContainer) return;
        const amount = direction === 'left' ? -120 : 120;
        tabContainer.scrollBy({ left: amount, behavior: 'smooth' });
    }

    function setActiveTab(tab: string) {
        activeTab = tab;
        requestAnimationFrame(() => scrollActiveTabIntoView(activeTabIndex));
    }
</script>

<div class="bg-background w-full rounded-t-lg border p-3 shadow-lg sm:w-[340px] sm:rounded-lg">
    {#if loading}
        <div class="flex h-[280px] items-center justify-center">
            <span class="text-muted-foreground text-sm">로딩 중...</span>
        </div>
    {:else if error}
        <div class="flex h-[280px] items-center justify-center">
            <span class="text-muted-foreground text-sm">이모티콘을 불러올 수 없습니다</span>
        </div>
    {:else}
        <!-- 팩 탭 (가로 스크롤 + 화살표 네비게이션) -->
        <div class="flex items-center gap-0.5">
            <!-- 좌측 화살표 -->
            <button
                type="button"
                onclick={() => scrollTabs('left')}
                class="flex size-6 shrink-0 items-center justify-center rounded transition-colors {canScrollLeft
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    : 'pointer-events-none text-transparent'}"
                tabindex={-1}
            >
                <svg
                    class="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg
                >
            </button>

            <div
                bind:this={tabContainer}
                onscroll={updateScrollHints}
                class="flex min-w-0 flex-1 gap-1 overflow-x-auto"
                style="scrollbar-width: none;"
            >
                {#each packs as pack, i}
                    <button
                        type="button"
                        onclick={() => setActiveTab(`pack-${i}`)}
                        class="flex size-8 shrink-0 items-center justify-center rounded-md p-1 transition-colors {activeTab ===
                        `pack-${i}`
                            ? 'ring-primary/50 bg-primary/10 ring-2'
                            : 'bg-muted hover:bg-muted/80'}"
                        title="{pack.name} ({pack.count}개)"
                    >
                        {#if pack.items.length > 0}
                            <img
                                src={thumbUrl(pack.items[0])}
                                alt={pack.name}
                                class="size-5 object-contain"
                            />
                        {/if}
                    </button>
                {/each}
                <button
                    type="button"
                    onclick={() => setActiveTab('emoji')}
                    class="flex size-8 shrink-0 items-center justify-center rounded-md p-1 transition-colors {activeTab ===
                    'emoji'
                        ? 'ring-primary/50 bg-primary/10 ring-2'
                        : 'bg-muted hover:bg-muted/80'}"
                    title="이모지"
                >
                    <span class="text-base leading-none">😀</span>
                </button>
            </div>

            <!-- 우측 화살표 -->
            <button
                type="button"
                onclick={() => scrollTabs('right')}
                class="flex size-6 shrink-0 items-center justify-center rounded transition-colors {canScrollRight
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    : 'pointer-events-none text-transparent'}"
                tabindex={-1}
            >
                <svg
                    class="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg
                >
            </button>
        </div>

        <!-- 활성 팩 이름 -->
        <p class="text-muted-foreground mb-0.5 mt-1 truncate px-1 text-[11px]">
            {#if activePack}
                {activePack.name} ({activePack.count}개)
            {:else if activeTab === 'emoji'}
                이모지
            {/if}
        </p>

        <!-- 이모티콘 그리드 -->
        <div>
            {#if activeTab === 'emoji'}
                <div class="grid max-h-[240px] grid-cols-6 gap-1.5 overflow-y-auto p-1">
                    {#each emojis as emo}
                        <button
                            type="button"
                            onclick={() => selectEmoji(emo.emoji ?? '')}
                            class="hover:bg-muted flex items-center justify-center rounded-lg p-1.5 text-2xl transition-colors"
                            title={emo.emoji}
                        >
                            {emo.emoji}
                        </button>
                    {/each}
                </div>
            {:else}
                {#each packs as pack, i}
                    {#if activeTab === `pack-${i}`}
                        <div class="grid max-h-[240px] grid-cols-6 gap-1.5 overflow-y-auto p-1">
                            {#each pack.items as item}
                                <button
                                    type="button"
                                    onclick={() => selectEmoticon(item.file)}
                                    class="hover:bg-muted group/emo relative flex items-center justify-center rounded-lg p-1 transition-colors"
                                    title={item.file}
                                >
                                    <img
                                        src={thumbUrl(item)}
                                        alt={item.file}
                                        class="size-10 object-contain transition-transform group-hover/emo:z-50 group-hover/emo:scale-[3]"
                                        loading="lazy"
                                    />
                                </button>
                            {/each}
                        </div>
                    {/if}
                {/each}
            {/if}
        </div>
    {/if}
</div>
