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
</script>

<div class="bg-background w-[340px] rounded-lg border p-3 shadow-lg">
    {#if loading}
        <div class="flex h-[280px] items-center justify-center">
            <span class="text-muted-foreground text-sm">로딩 중...</span>
        </div>
    {:else if error}
        <div class="flex h-[280px] items-center justify-center">
            <span class="text-muted-foreground text-sm">이모티콘을 불러올 수 없습니다</span>
        </div>
    {:else}
        <!-- 팩 탭 (가로 스크롤) -->
        <div class="flex gap-1 overflow-x-auto pb-2" style="scrollbar-width: thin;">
            {#each packs as pack, i}
                <button
                    type="button"
                    onclick={() => (activeTab = `pack-${i}`)}
                    class="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors {activeTab ===
                    `pack-${i}`
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
                >
                    {pack.name}
                </button>
            {/each}
            <button
                type="button"
                onclick={() => (activeTab = 'emoji')}
                class="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors {activeTab ===
                'emoji'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
            >
                이모지
            </button>
        </div>

        <!-- 이모티콘 그리드 -->
        <div class="mt-1">
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
                                    class="hover:bg-muted flex items-center justify-center rounded-lg p-1 transition-colors"
                                    title={item.file}
                                >
                                    <img
                                        src={thumbUrl(item)}
                                        alt={item.file}
                                        class="size-10 object-contain"
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
