<script lang="ts">
    /** g5_content 페이지 렌더러 (개인정보, 이용약관 등) */
    interface Props { contentId: string; }
    const { contentId }: Props = $props();

    let title = $state('');
    let content = $state('');
    let loading = $state(true);

    $effect(() => {
        fetch(`/api/muzia/content?id=${contentId}`)
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    title = d.data.co_subject;
                    content = d.data.co_content;
                }
            })
            .finally(() => loading = false);
    });
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
    {#if loading}
        <div class="py-20 text-center text-muted-foreground">로딩 중...</div>
    {:else}
        <h1 class="mb-6 text-2xl font-bold">{title}</h1>
        <div class="prose prose-sm max-w-none dark:prose-invert">
            {@html content}
        </div>
    {/if}
</div>
