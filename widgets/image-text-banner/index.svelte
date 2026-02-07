<script lang="ts">
    /**
     * 이미지+텍스트 배너 위젯
     * 2x2 그리드로 4개 배너 표시
     * Soft Modern 디자인 가이드라인 적용
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import ImageIcon from '@lucide/svelte/icons/image';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    interface Banner {
        image: string;
        link: string;
        text: string;
    }

    // 위젯 설정에서 배너 데이터 가져오기
    const banners = $derived<Banner[]>(() => {
        const result: Banner[] = [];
        for (let i = 1; i <= 4; i++) {
            const image = (config?.settings?.[`banner${i}_image`] as string) || '';
            const link = (config?.settings?.[`banner${i}_link`] as string) || '';
            const text = (config?.settings?.[`banner${i}_text`] as string) || '';

            // 이미지나 텍스트가 있는 경우만 추가
            if (image || text) {
                result.push({ image, link, text });
            }
        }
        return result;
    });

    const hasBanners = $derived(banners().length > 0);
</script>

<div class="bg-background border-border overflow-hidden rounded-xl border shadow-sm">
    <!-- 헤더 -->
    <div class="bg-muted/50 border-border flex items-center gap-2 border-b px-4 py-2.5">
        <div class="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg">
            <LayoutGrid class="text-primary h-4 w-4" />
        </div>
        <span class="text-foreground flex-1 text-sm font-medium">추천</span>
    </div>

    <!-- 본문 -->
    <div class="p-3">
        {#if !hasBanners}
            <div class="text-muted-foreground py-4 text-center text-sm">
                <ImageIcon class="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>배너가 설정되지 않았습니다.</p>
            </div>
        {:else}
            <div class="grid grid-cols-2 gap-2">
                {#each banners() as banner, i (i)}
                    <a
                        href={banner.link || 'javascript:void(0)'}
                        target={banner.link?.startsWith('http') ? '_blank' : undefined}
                        rel={banner.link?.startsWith('http')
                            ? 'noopener noreferrer nofollow'
                            : undefined}
                        class="border-border hover:border-primary group block overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 hover:-translate-y-0.5 dark:bg-gray-900"
                    >
                        {#if banner.image}
                            <figure class="m-0">
                                <img
                                    src={banner.image}
                                    alt={banner.text || `배너 ${i + 1}`}
                                    class="h-20 w-full object-cover object-center transition-opacity group-hover:opacity-95"
                                    loading="lazy"
                                />
                                {#if banner.text}
                                    <figcaption
                                        class="text-primary truncate bg-white px-2 py-1.5 text-center text-xs dark:bg-gray-900"
                                    >
                                        {banner.text}
                                    </figcaption>
                                {/if}
                            </figure>
                        {:else}
                            <!-- 텍스트만 있는 경우 -->
                            <div class="bg-muted/30 flex h-20 items-center justify-center px-2">
                                <span class="text-primary text-center text-xs">{banner.text}</span>
                            </div>
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    figure {
        margin: 0;
    }

    img {
        display: block;
    }
</style>
