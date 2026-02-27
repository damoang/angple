<script lang="ts">
    import { onMount } from 'svelte';
    import {
        getCelebrations,
        getCurrentIndex,
        mount as celebrationMount,
        type CelebrationBanner
    } from '$lib/stores/celebration.svelte.js';

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();

    let celebrations = $derived(getCelebrations());
    let currentIndex = $derived(getCurrentIndex());

    onMount(() => {
        return celebrationMount();
    });

    function stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }

    function getDisplayText(banner: CelebrationBanner): string {
        const nick = banner.target_member_nick || '';
        const contentText = stripHtml(banner.content || '');
        // content가 비면 title 사용 (ads admin의 cardMainText가 title에 포함됨)
        // 단, title이 날짜 형식(YYYY.MM.DD 등)이면 무시
        const titleText = banner.title || '';
        const isDateTitle = /^\d{4}[.\-]\d{2}[.\-]\d{2}/.test(titleText);
        const message = contentText || (!isDateTitle ? titleText : '');
        if (nick && message) return `[${nick}님] ${message}`;
        if (nick) return `[${nick}님] 축하합니다!`;
        if (message) return message;
        return '축하합니다!';
    }
</script>

{#if celebrations.length > 0}
    <a
        href={celebrations[currentIndex]?.external_link ||
            celebrations[currentIndex]?.link_url ||
            '#'}
        target={celebrations[currentIndex]?.link_target || '_self'}
        rel="nofollow noopener"
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
