<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
    import { REACTION_EMOTICONS } from '$lib/config/reaction-config.js';

    interface Props {
        onInsertEmoticon: (text: string) => void;
        onClose: () => void;
    }

    let { onInsertEmoticon, onClose }: Props = $props();

    // 앙티콘 (커스텀 GIF)
    const angticons = REACTION_EMOTICONS.filter((e) => e.category === 'angticon');

    // 이모지 (유니코드)
    const emojis = REACTION_EMOTICONS.filter((e) => e.category === 'emoji');

    function selectAngticon(url: string): void {
        // URL에서 파일명만 추출 (예: /api/emoticons/nariya/damoang-emo-008.gif → damoang-emo-008.gif)
        const filename = url.split('/').pop() || url;
        onInsertEmoticon(`{emo:${filename}}`);
        onClose();
    }

    function selectEmoji(emoji: string): void {
        onInsertEmoticon(emoji);
        onClose();
    }
</script>

<div class="bg-background w-[320px] rounded-lg border p-3 shadow-lg">
    <Tabs value="angticon">
        <TabsList class="w-full">
            <TabsTrigger value="angticon" class="flex-1">앙티콘</TabsTrigger>
            <TabsTrigger value="emoji" class="flex-1">이모지</TabsTrigger>
        </TabsList>

        <TabsContent value="angticon">
            <div class="grid max-h-[240px] grid-cols-6 gap-2 overflow-y-auto p-1">
                {#each angticons as emo}
                    <button
                        type="button"
                        onclick={() => selectAngticon(emo.url ?? '')}
                        class="hover:bg-muted flex items-center justify-center rounded-lg p-1.5 transition-colors"
                        title={emo.reaction}
                    >
                        <img src={emo.url} alt={emo.reaction} class="size-8" loading="lazy" />
                    </button>
                {/each}
            </div>
        </TabsContent>

        <TabsContent value="emoji">
            <div class="grid max-h-[240px] grid-cols-6 gap-2 overflow-y-auto p-1">
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
        </TabsContent>
    </Tabs>
</div>
