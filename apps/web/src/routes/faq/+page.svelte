<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Accordion from '$lib/components/ui/accordion/index.js';
    import DOMPurify from 'isomorphic-dompurify';
    import CircleHelp from '@lucide/svelte/icons/circle-help';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    // 현재 선택된 카테고리
    let selectedCategoryId = $state(data.categories[0]?.fm_id ?? 0);

    // 선택된 카테고리의 항목 필터
    const filteredItems = $derived(data.items.filter((item) => item.fm_id === selectedCategoryId));

    // HTML 안전하게 렌더링
    function sanitize(html: string): string {
        return DOMPurify.sanitize(html);
    }
</script>

<svelte:head>
    <title>자주 묻는 질문 (FAQ) | 다모앙</title>
    <meta name="description" content="다모앙 커뮤니티 자주 묻는 질문과 답변입니다." />
</svelte:head>

<div class="mx-auto max-w-3xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6">
        <div class="flex items-center gap-3">
            <CircleHelp class="text-primary h-7 w-7" />
            <h1 class="text-foreground text-3xl font-bold">자주 묻는 질문</h1>
        </div>
    </div>

    {#if data.categories.length === 0}
        <Card class="bg-background">
            <CardContent class="py-12 text-center">
                <CircleHelp class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-muted-foreground">등록된 FAQ가 없습니다.</p>
            </CardContent>
        </Card>
    {:else}
        <!-- 카테고리 탭 -->
        <div class="mb-6 flex flex-wrap gap-2">
            {#each data.categories as category (category.fm_id)}
                <Badge
                    variant={selectedCategoryId === category.fm_id ? 'default' : 'outline'}
                    class="cursor-pointer rounded-full px-4 py-2 text-sm"
                    onclick={() => (selectedCategoryId = category.fm_id)}
                >
                    {category.fm_subject}
                </Badge>
            {/each}
        </div>

        <!-- FAQ 아코디언 -->
        <Card class="bg-background">
            <CardContent class="pt-6">
                {#if filteredItems.length === 0}
                    <p class="text-muted-foreground py-8 text-center text-sm">
                        이 카테고리에 등록된 질문이 없습니다.
                    </p>
                {:else}
                    <Accordion.Root type="single" class="w-full">
                        {#each filteredItems as item (item.fa_id)}
                            <Accordion.Item value="faq-{item.fa_id}">
                                <Accordion.Trigger>
                                    {item.fa_subject}
                                </Accordion.Trigger>
                                <Accordion.Content>
                                    <div class="faq-content prose prose-sm max-w-none">
                                        {@html sanitize(item.fa_content)}
                                    </div>
                                </Accordion.Content>
                            </Accordion.Item>
                        {/each}
                    </Accordion.Root>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>

<style>
    :global(.faq-content img) {
        max-width: 100%;
        height: auto;
    }

    :global(.faq-content a) {
        color: var(--primary);
        text-decoration: underline;
    }
</style>
