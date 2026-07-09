<script lang="ts">
    import ContentPage from '$lib/components/features/content/content-page.svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto max-w-4xl px-4 pt-8">
    <a
        href="/privacy/history"
        class="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
    >
        ← 이전 버전 목록
    </a>
    <div
        class="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
    >
        제{data.version.version_no}판 · {data.version.effective_date} 시행 예정 — 미리보기
    </div>
</div>

<ContentPage title={data.version.title || '개인정보처리방침'} content={data.version.content} />
