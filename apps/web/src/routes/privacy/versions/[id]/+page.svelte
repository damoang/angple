<script lang="ts">
    import ContentPage from '$lib/components/features/content/content-page.svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const bannerText = $derived(
        data.version.status === 'scheduled'
            ? `이 방침은 ${data.version.effective_date} 부터 적용될 예정입니다.`
            : `이 방침은 ${data.version.effective_date} 부터 적용되었습니다.`
    );
</script>

<div class="mx-auto max-w-4xl px-4 pt-8">
    <a
        href="/privacy/history"
        class="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
    >
        ← 이전 버전 목록
    </a>
    <div
        class="border-primary/40 bg-primary/5 text-foreground mt-3 rounded-lg border px-4 py-3 text-sm"
    >
        제{data.version.version_no}판 · {bannerText}
    </div>
</div>

<ContentPage title={data.version.title || '개인정보처리방침'} content={data.version.content} />
