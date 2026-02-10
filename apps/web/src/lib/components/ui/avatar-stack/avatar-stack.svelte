<script lang="ts">
    import { getMemberIconUrl } from '$lib/utils/member-icon.js';

    interface AvatarItem {
        mb_id: string;
        mb_nick?: string;
        mb_name?: string;
    }

    interface Props {
        items: AvatarItem[];
        max?: number;
        size?: 'sm' | 'md';
        total?: number;
        onclick?: () => void;
    }

    let { items, max = 5, size = 'sm', total, onclick }: Props = $props();

    const visibleItems = $derived(items.slice(0, max));
    const remaining = $derived((total ?? items.length) - visibleItems.length);
    const sizeClass = $derived(size === 'sm' ? 'size-6' : 'size-7');
    const textSize = $derived(size === 'sm' ? 'text-[10px]' : 'text-xs');
</script>

<button
    type="button"
    class="flex items-center transition-opacity hover:opacity-80"
    {onclick}
    title="추천한 사람들 보기"
>
    <div class="flex items-center -space-x-1.5">
        {#each visibleItems as item (item.mb_id)}
            {@const iconUrl = getMemberIconUrl(item.mb_id)}
            {@const nick = item.mb_nick || item.mb_name || item.mb_id}
            {#if iconUrl}
                <img
                    src={iconUrl}
                    alt={nick}
                    title={nick}
                    class="{sizeClass} ring-background rounded-full object-cover ring-2"
                    onerror={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = 'none';
                        const fallback = img.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                    }}
                />
                <div
                    class="bg-muted text-muted-foreground hidden {sizeClass} ring-background items-center justify-center rounded-full ring-2 {textSize} font-medium"
                    title={nick}
                >
                    {nick.charAt(0).toUpperCase()}
                </div>
            {:else}
                <div
                    class="bg-muted text-muted-foreground flex {sizeClass} ring-background items-center justify-center rounded-full ring-2 {textSize} font-medium"
                    title={nick}
                >
                    {nick.charAt(0).toUpperCase()}
                </div>
            {/if}
        {/each}
        {#if remaining > 0}
            <div
                class="bg-muted text-muted-foreground flex {sizeClass} ring-background items-center justify-center rounded-full ring-2 {textSize} font-medium"
            >
                +{remaining}
            </div>
        {/if}
    </div>
</button>
