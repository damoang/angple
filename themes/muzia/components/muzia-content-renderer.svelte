<script lang="ts">
    /**
     * Muzia Content Renderer
     * - HTML 콘텐츠에서 YouTube URL을 감지하여 임베드 변환
     * - DOMPurify가 iframe을 차단하므로 테마 레벨에서 직접 처리
     */

    interface Props {
        html: string;
    }

    const { html }: Props = $props();

    // YouTube URL에서 비디오 ID 추출
    function extractYouTubeIds(content: string): string[] {
        const ids: string[] = [];
        const patterns = [
            /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
            /youtu\.be\/([a-zA-Z0-9_-]{11})/g,
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (!ids.includes(match[1])) ids.push(match[1]);
            }
        }
        return ids;
    }

    const youtubeIds = $derived(extractYouTubeIds(html));
</script>

<!-- YouTube 임베드 (콘텐츠 위에 표시) -->
{#if youtubeIds.length > 0}
    <div class="mb-4 space-y-3">
        {#each youtubeIds as videoId}
            <div class="relative overflow-hidden rounded-lg" style="padding-bottom: 56.25%;">
                <iframe
                    src="https://www.youtube.com/embed/{videoId}"
                    title="YouTube video"
                    class="absolute inset-0 h-full w-full"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                ></iframe>
            </div>
        {/each}
    </div>
{/if}

<!-- HTML 콘텐츠 -->
<div class="prose prose-sm max-w-none dark:prose-invert">
    {@html html}
</div>
