<script lang="ts">
    import { dompurify as DOMPurify } from '$lib/utils/dompurify.js';
    import { SeoHead } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const fromHtml = $derived(data.from ? DOMPurify.sanitize(data.from.content) : '');
    const toHtml = $derived(data.to ? DOMPurify.sanitize(data.to.content) : '');

    function statusLabel(status: string): string {
        if (status === 'active') return '현재 적용중';
        if (status === 'scheduled') return '시행 예정';
        if (status === 'archived') return '이전 버전';
        return status;
    }

    const seo: SeoConfig = {
        meta: {
            title: '개인정보 처리방침 — 신구 대조표',
            description: '개인정보 처리방침의 이전 버전과 현재/예정 버전을 나란히 비교합니다.'
        },
        og: { title: '개인정보 처리방침 — 신구 대조표', type: 'website' }
    };
</script>

<SeoHead config={seo} />

<div class="mx-auto max-w-6xl px-4 py-8">
    <h1 class="text-foreground mb-2 text-3xl font-bold">개인정보 처리방침 — 신구 대조표</h1>
    <p class="text-muted-foreground mb-6 text-sm">
        두 버전을 나란히 비교합니다.
        <a href="/privacy/history" class="hover:text-foreground underline underline-offset-4">
            버전 목록으로
        </a>
    </p>

    {#if !data.from && !data.to}
        <div class="text-muted-foreground py-12 text-center">
            <p>비교할 버전을 찾을 수 없습니다.</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section class="border-border rounded-lg border">
                <header class="border-border bg-muted/40 border-b px-4 py-3">
                    {#if data.from}
                        <div class="text-foreground font-semibold">
                            제{data.from.version_no}판 · {statusLabel(data.from.status)}
                        </div>
                        <div class="text-muted-foreground text-sm">
                            시행 {data.from.effective_date}
                        </div>
                    {:else}
                        <div class="text-muted-foreground font-semibold">이전 버전 없음</div>
                    {/if}
                </header>
                {#if fromHtml}
                    <div class="prose dark:prose-invert max-w-none px-4 py-4">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html fromHtml}
                    </div>
                {:else}
                    <div class="text-muted-foreground px-4 py-12 text-center">
                        비교 대상이 없습니다.
                    </div>
                {/if}
            </section>

            <section class="border-border rounded-lg border">
                <header class="border-border bg-muted/40 border-b px-4 py-3">
                    {#if data.to}
                        <div class="text-foreground font-semibold">
                            제{data.to.version_no}판 · {statusLabel(data.to.status)}
                        </div>
                        <div class="text-muted-foreground text-sm">
                            시행 {data.to.effective_date}
                        </div>
                    {:else}
                        <div class="text-muted-foreground font-semibold">비교 버전 없음</div>
                    {/if}
                </header>
                {#if toHtml}
                    <div class="prose dark:prose-invert max-w-none px-4 py-4">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html toHtml}
                    </div>
                {:else}
                    <div class="text-muted-foreground px-4 py-12 text-center">
                        비교 대상이 없습니다.
                    </div>
                {/if}
            </section>
        </div>
    {/if}
</div>
