<script lang="ts">
    import { browser } from '$app/environment';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import PartyPopper from '@lucide/svelte/icons/party-popper';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';

    interface Banner {
        id: number;
        title: string;
        content: string;
        image_url: string;
        link_url: string;
        target_member_nick?: string;
        target_member_photo?: string;
        display_type: 'image' | 'text';
    }

    interface Props {
        config: WidgetConfig;
        slot?: string;
        isEditMode?: boolean;
        prefetchData?: { data: Banner[] } | null;
    }

    const { prefetchData = null }: Props = $props();

    let banners = $state<Banner[]>(prefetchData?.data ?? []);
    let loaded = $state(!!prefetchData);

    $effect(() => {
        if (!loaded && browser) {
            fetch('/api/ads/celebration/today')
                .then((r) => r.json())
                .then((res) => {
                    if (res.success && res.data) {
                        banners = res.data;
                    }
                })
                .catch(() => {})
                .finally(() => {
                    loaded = true;
                });
        }
    });

    // 최대 6개 표시 (3x2 그리드)
    const displayBanners = $derived(banners.slice(0, 6));
    const hasBanners = $derived(displayBanners.length > 0);
</script>

{#if hasBanners}
    <Card class="gap-0">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-3">
            <div class="flex items-center gap-2">
                <PartyPopper class="text-primary h-5 w-5" />
                <h3 class="text-base font-semibold">축하메시지</h3>
            </div>
            <a
                href="/message"
                class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[15px] transition-all duration-200 ease-out"
            >
                더보기
                <ChevronRight class="h-4 w-4" />
            </a>
        </CardHeader>

        <CardContent class="px-4 pb-4">
            <div class="grid grid-cols-3 gap-2">
                {#each displayBanners as banner (banner.id)}
                    <a
                        href={banner.link_url || `/message/${banner.id}`}
                        class="group relative overflow-hidden rounded-lg border transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
                    >
                        <div class="bg-muted relative aspect-[4/1] overflow-hidden">
                            {#if banner.image_url}
                                <img
                                    src={banner.image_url}
                                    alt={banner.target_member_nick || '축하메시지'}
                                    class="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            {:else}
                                <div class="flex h-full w-full items-center justify-center">
                                    <PartyPopper class="text-muted-foreground h-6 w-6" />
                                </div>
                            {/if}
                            {#if banner.target_member_nick}
                                <div
                                    class="absolute inset-x-0 bottom-0 truncate px-1 py-0.5 text-center text-xs font-bold text-white [text-shadow:_-1px_-1px_0_rgba(0,0,0,0.6),_1px_-1px_0_rgba(0,0,0,0.6),_-1px_1px_0_rgba(0,0,0,0.6),_1px_1px_0_rgba(0,0,0,0.6)]"
                                >
                                    {banner.target_member_nick}
                                </div>
                            {/if}
                        </div>
                    </a>
                {/each}
            </div>
        </CardContent>
    </Card>
{/if}
