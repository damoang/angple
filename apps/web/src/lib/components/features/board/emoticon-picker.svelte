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

    /** 기본 노출 팩 수 */
    const DEFAULT_VISIBLE = 5;

    let packs = $state<EmoticonPack[]>([]);
    let loading = $state(true);
    let error = $state(false);
    let expanded = $state(false);
    let activeTab = $state('pack-0');
    let activePack = $derived(
        activeTab.startsWith('pack-') ? packs[parseInt(activeTab.split('-')[1])] : null
    );

    /** 현재 보이는 팩 목록 */
    let visiblePacks = $derived(expanded ? packs : packs.slice(0, DEFAULT_VISIBLE));
    let hasMore = $derived(packs.length > DEFAULT_VISIBLE);

    // 마운트 시 API 호출
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

    function setActiveTab(tab: string) {
        activeTab = tab;
        // 접힌 상태에서 더보기 팩을 선택한 경우 자동 펼침
        if (tab.startsWith('pack-')) {
            const idx = parseInt(tab.split('-')[1]);
            if (idx >= DEFAULT_VISIBLE && !expanded) {
                expanded = true;
            }
        }
    }

    function toggleExpand() {
        expanded = !expanded;
        // 접을 때 선택된 탭이 보이는 범위 밖이면 첫 번째 팩으로 이동
        if (!expanded && activeTab.startsWith('pack-')) {
            const idx = parseInt(activeTab.split('-')[1]);
            if (idx >= DEFAULT_VISIBLE) {
                activeTab = 'pack-0';
            }
        }
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
        <!-- 팩 탭 -->
        <div class="flex flex-wrap items-center gap-1">
            {#each visiblePacks as pack, i}
                {@const realIndex = expanded ? i : i}
                <button
                    type="button"
                    onclick={() => setActiveTab(`pack-${realIndex}`)}
                    class="flex size-8 shrink-0 items-center justify-center rounded-md p-1 transition-colors {activeTab ===
                    `pack-${realIndex}`
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

            <!-- 더보기/접기 버튼 -->
            {#if hasMore}
                <button
                    type="button"
                    onclick={toggleExpand}
                    class="text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
                    title={expanded ? '접기' : `더보기 (+${packs.length - DEFAULT_VISIBLE})`}
                >
                    {#if expanded}
                        <svg
                            class="size-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg
                        >
                    {:else}
                        <span class="text-xs font-medium">+{packs.length - DEFAULT_VISIBLE}</span>
                    {/if}
                </button>
            {/if}

            <!-- 이모지 탭 (항상 보임) -->
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
                                        class="emoticon-inline size-10 object-contain transition-transform group-hover/emo:z-50 group-hover/emo:scale-[3]"
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
