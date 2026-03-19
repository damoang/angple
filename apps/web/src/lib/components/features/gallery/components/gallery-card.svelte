<script lang="ts">
    import type { GalleryPost } from '$lib/api/types.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { browser } from '$app/environment';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';

    type Props = {
        post: GalleryPost;
    };

    let { post }: Props = $props();

    // URL에서 boardId 추출
    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }

    const isRead = $derived(browser && readPostsStore.isRead(getBoardId(post.url), post.id));

    const rawThumbnailUrl = $derived(post.thumbnail_url || '');
    const thumbnailUrl = $derived(toThumbnailUrl(rawThumbnailUrl));
</script>

<a
    href={post.url}
    class="bg-card border-border group flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out hover:shadow-md"
>
    <!-- 16:9 이미지 -->
    <div class="relative aspect-video w-full overflow-hidden">
        {#if rawThumbnailUrl}
            <img
                src={thumbnailUrl}
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                alt={post.title}
                onerror={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (rawThumbnailUrl && target.src !== rawThumbnailUrl) {
                        target.src = rawThumbnailUrl;
                    } else {
                        target.style.display = 'none';
                    }
                }}
            />
        {:else}
            <div class="bg-muted flex h-full w-full items-center justify-center">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="currentColor"
                    class="text-muted-foreground"
                    viewBox="0 0 16 16"
                >
                    <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                    <path
                        d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"
                    />
                </svg>
            </div>
        {/if}
    </div>

    <!-- 제목만 -->
    <div class="p-2.5">
        <p
            class="line-clamp-2 text-[15px] font-medium {isRead
                ? 'text-muted-foreground'
                : 'text-foreground'}"
        >
            {post.title}
        </p>
    </div>
</a>
