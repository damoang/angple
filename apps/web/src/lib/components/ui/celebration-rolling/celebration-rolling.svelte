<script lang="ts">
    import { onMount } from 'svelte';
    import {
        mount,
        getCelebrations,
        getCurrentIndex,
        getLink
    } from '$lib/stores/celebration.svelte';

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();

    let celebrations = $derived(getCelebrations());
    let currentIndex = $derived(getCurrentIndex());

    onMount(() => {
        return mount();
    });

    function getDisplayText(banner: { target_member_nick?: string }): string {
        const nick = banner.target_member_nick || '';
        if (nick) return nick;
        return '축하합니다!';
    }
</script>

{#if celebrations.length > 0}
    <a
        href={getLink(celebrations[currentIndex])}
        class="border-border bg-background hover:bg-accent flex h-9 items-center gap-2 overflow-hidden rounded-lg border px-3 transition-colors {className}"
    >
        {#if celebrations[currentIndex]?.target_member_photo}
            <img
                src={celebrations[currentIndex].target_member_photo}
                alt=""
                class="h-6 w-6 shrink-0 rounded-full object-cover"
            />
        {/if}

        <div class="relative h-7 min-w-0 flex-1 overflow-hidden">
            {#each celebrations as banner, i (banner.id)}
                <span
                    class="text-foreground absolute inset-0 flex items-center truncate text-sm transition-all duration-500 ease-in-out
                        {i === currentIndex
                        ? 'translate-y-0 opacity-100'
                        : i < currentIndex
                          ? '-translate-y-full opacity-0'
                          : 'translate-y-full opacity-0'}"
                >
                    {getDisplayText(banner)}
                </span>
            {/each}
        </div>
        <span class="text-muted-foreground shrink-0 text-xs">&rarr;</span>
    </a>
{/if}
