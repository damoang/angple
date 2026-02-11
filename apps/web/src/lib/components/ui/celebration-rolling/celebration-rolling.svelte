<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();

    interface CelebrationBanner {
        id: number;
        title: string;
        content: string;
        image_url: string;
        link_url: string;
        target_member_nick?: string;
        target_member_photo?: string;
        external_link?: string;
        link_target?: string;
        display_type?: 'image' | 'text';
    }

    let celebrations = $state<CelebrationBanner[]>([]);
    let currentIndex = $state(0);

    onMount(() => {
        fetchCelebrations();
    });

    // 4초 간격 롤링 (2개 이상일 때만)
    $effect(() => {
        if (celebrations.length <= 1) return;

        currentIndex = 0;

        const intervalId = setInterval(() => {
            currentIndex = (currentIndex + 1) % celebrations.length;
        }, 4000);

        return () => clearInterval(intervalId);
    });

    async function fetchCelebrations(): Promise<void> {
        if (!browser) return;

        try {
            const response = await fetch('/api/plugins/advertising/banners/today', {
                method: 'GET',
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) return;

            const result = await response.json();

            if (result.success && result.data?.length > 0) {
                celebrations = result.data;
            }
        } catch (error) {
            console.warn('CelebrationRolling: 축하메시지 로드 실패', error);
        }
    }

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
        if (nick && message) return `${nick}님, ${message}`;
        if (nick) return `${nick}님, 축하합니다!`;
        if (message) return message;
        return '축하합니다!';
    }
</script>

{#if celebrations.length > 0}
    <a
        href={celebrations[currentIndex]?.external_link ||
            celebrations[currentIndex]?.link_url ||
            '#'}
        target={celebrations[currentIndex]?.link_target || '_blank'}
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
