<script lang="ts">
    /**
     * 관리자 정적 페이지(콘텐츠) 목록
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import FileText from '@lucide/svelte/icons/file-text';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Search from '@lucide/svelte/icons/search';
    import Eye from '@lucide/svelte/icons/eye';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import { listContents, type ContentListItem } from '$lib/api/admin-contents';

    let contents = $state<ContentListItem[]>([]);
    let loading = $state(true);
    let searchQuery = $state('');

    const filteredContents = $derived(
        searchQuery.trim()
            ? contents.filter(
                  (c) =>
                      c.co_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.co_subject.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : contents
    );

    async function fetchData() {
        loading = true;
        try {
            contents = await listContents();
        } catch {
            // 에러는 API 함수에서 이미 로깅됨
        } finally {
            loading = false;
        }
    }

    function getLevelLabel(level: number): string {
        if (level <= 0) return '전체';
        if (level < 10) return `레벨 ${level}+`;
        return '관리자';
    }

    onMount(() => {
        fetchData();
    });
</script>

<svelte:head>
    <title>내용 관리 - Angple Admin</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
    <div>
        <h1 class="text-2xl font-bold">내용 관리</h1>
        <p class="text-muted-foreground text-sm">
            정적 페이지(이용약관, 개인정보처리방침 등)를 관리합니다.
        </p>
    </div>

    <!-- 검색 -->
    <div class="relative">
        <Search class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
            bind:value={searchQuery}
            placeholder="페이지 ID 또는 제목으로 검색..."
            class="pl-9"
        />
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
            <span class="text-muted-foreground ml-2 text-sm">로딩 중...</span>
        </div>
    {:else if filteredContents.length === 0}
        <Card.Root>
            <Card.Content class="flex flex-col items-center justify-center py-12">
                <FileText class="text-muted-foreground mb-4 h-12 w-12" />
                {#if searchQuery}
                    <p class="text-muted-foreground mb-2">검색 결과가 없습니다.</p>
                    <Button variant="outline" onclick={() => (searchQuery = '')}>
                        검색 초기화
                    </Button>
                {:else}
                    <p class="text-muted-foreground">등록된 정적 페이지가 없습니다.</p>
                {/if}
            </Card.Content>
        </Card.Root>
    {:else}
        <Card.Root>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="p-3 text-left font-medium">페이지 ID</th>
                            <th class="p-3 text-left font-medium">제목</th>
                            <th class="p-3 text-center font-medium">접근 레벨</th>
                            <th class="p-3 text-center font-medium">HTML</th>
                            <th class="p-3 text-center font-medium">조회수</th>
                            <th class="p-3 text-right font-medium">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each filteredContents as content (content.co_id)}
                            <tr class="hover:bg-muted/50 border-b transition-colors">
                                <td class="p-3">
                                    <code class="bg-muted rounded px-1.5 py-0.5 text-xs">
                                        {content.co_id}
                                    </code>
                                </td>
                                <td class="p-3">
                                    <span class="font-medium"
                                        >{content.co_subject || '(제목 없음)'}</span
                                    >
                                    {#if content.co_seo_title}
                                        <p class="text-muted-foreground text-xs">
                                            SEO: {content.co_seo_title}
                                        </p>
                                    {/if}
                                </td>
                                <td class="p-3 text-center">
                                    <Badge
                                        variant={content.co_level >= 10 ? 'destructive' : 'outline'}
                                        class="text-xs"
                                    >
                                        {getLevelLabel(content.co_level)}
                                    </Badge>
                                </td>
                                <td class="p-3 text-center">
                                    <Badge
                                        variant={content.co_html === 1 ? 'default' : 'secondary'}
                                        class="text-xs"
                                    >
                                        {content.co_html === 1 ? 'HTML' : 'TEXT'}
                                    </Badge>
                                </td>
                                <td class="p-3 text-center">
                                    <div class="flex items-center justify-center gap-1">
                                        <Eye class="h-3.5 w-3.5 opacity-50" />
                                        {content.co_hit.toLocaleString()}
                                    </div>
                                </td>
                                <td class="p-3 text-right">
                                    <div class="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            href="/content/{content.co_id}"
                                            title="미리보기"
                                            target="_blank"
                                        >
                                            <ExternalLink class="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            href="/admin/contents/{content.co_id}"
                                            title="편집"
                                        >
                                            <Pencil class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </Card.Root>
        <p class="text-muted-foreground text-xs">
            총 {filteredContents.length}개 페이지
            {#if searchQuery}(검색: "{searchQuery}"){/if}
        </p>
    {/if}
</div>
