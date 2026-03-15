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

    function getNick(banner: { target_member_nick?: string }): string {
        return banner.target_member_nick || '축하합니다';
    }

    function getMessage(banner: { content?: string }): string {
        return banner.content || '';
    }
</script>

{#if celebrations.length > 0}
    <a
        href={getLink(celebrations[currentIndex])}
        class="border-border bg-background hover:bg-accent flex h-9 items-center gap-2 overflow-hidden rounded-lg border px-3 transition-colors {className}"
    >
        <div class="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
            {#each celebrations as banner, i (banner.id)}
                {#if banner.target_member_photo}
                    <img
                        src={banner.target_member_photo}
                        alt=""
                        class="absolute inset-0 h-6 w-6 rounded-full object-cover transition-all duration-500 ease-in-out
                            {i === currentIndex
                            ? 'translate-y-0 opacity-100'
                            : i < currentIndex
                              ? '-translate-y-full opacity-0'
                              : 'translate-y-full opacity-0'}"
                    />
                {/if}
            {/each}
        </div>

        <div class="relative h-7 min-w-0 flex-1 overflow-hidden">
            {#each celebrations as banner, i (banner.id)}
                <span
                    class="absolute inset-0 flex items-center gap-1.5 truncate text-sm transition-all duration-500 ease-in-out
                        {i === currentIndex
                        ? 'translate-y-0 opacity-100'
                        : i < currentIndex
                          ? '-translate-y-full opacity-0'
                          : 'translate-y-full opacity-0'}"
                >
                    <span class="text-foreground font-medium">{getNick(banner)}</span>
                    {#if getMessage(banner)}
                        <span class="text-muted-foreground truncate">{getMessage(banner)}</span>
                    {/if}
                </span>
            {/each}
        </div>
        <span class="text-muted-foreground shrink-0 text-xs">&rarr;</span>
    </a>
{:else}
    <div
        class="border-border bg-background flex h-9 items-center justify-center rounded-lg border px-3 {className}"
    >
        <a
            href="/message"
            class="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >축하메시지가 없습니다</a
        >
    </div>
{/if}
