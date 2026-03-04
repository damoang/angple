<script lang="ts">
    /**
     * 관리자 정적 페이지 편집
     */
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Save from '@lucide/svelte/icons/save';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import { getContent, updateContent, type ContentDetail } from '$lib/api/admin-contents';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    let content = $state<ContentDetail | null>(null);
    let loading = $state(true);
    let saving = $state(false);
    let saveMessage = $state('');

    // 폼 상태
    let formSubject = $state('');
    let formContent = $state('');
    let formMobileContent = $state('');
    let formHtml = $state(true);
    let formSeoTitle = $state('');
    let formLevel = $state(0);

    async function fetchData() {
        loading = true;
        try {
            content = await getContent(data.coId);
            formSubject = content.co_subject;
            formContent = content.co_content;
            formMobileContent = content.co_mobile_content;
            formHtml = content.co_html === 1;
            formSeoTitle = content.co_seo_title;
            formLevel = content.co_level;
        } catch {
            // 에러는 API에서 이미 로깅됨
        } finally {
            loading = false;
        }
    }

    async function handleSave() {
        saving = true;
        saveMessage = '';
        try {
            await updateContent(data.coId, {
                co_subject: formSubject,
                co_content: formContent,
                co_mobile_content: formMobileContent,
                co_html: formHtml ? 1 : 0,
                co_seo_title: formSeoTitle,
                co_level: formLevel
            });
            saveMessage = '저장되었습니다.';
            setTimeout(() => (saveMessage = ''), 3000);
        } catch (err) {
            console.error('저장 실패:', err);
            alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            saving = false;
        }
    }

    onMount(() => {
        fetchData();
    });
</script>

<svelte:head>
    <title>{content?.co_subject || data.coId} 편집 - Angple Admin</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
    <!-- 헤더 -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
            <Button variant="ghost" size="icon" onclick={() => goto('/admin/contents')}>
                <ArrowLeft class="h-4 w-4" />
            </Button>
            <div>
                <h1 class="text-2xl font-bold">
                    {#if loading}
                        페이지 편집
                    {:else}
                        {content?.co_subject || data.coId}
                    {/if}
                </h1>
                <p class="text-muted-foreground text-sm">
                    ID: <code class="bg-muted rounded px-1.5 py-0.5 text-xs">{data.coId}</code>
                </p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            {#if saveMessage}
                <span class="text-sm text-green-600">{saveMessage}</span>
            {/if}
            <Button variant="outline" href="/content/{data.coId}" target="_blank">
                <ExternalLink class="mr-1.5 h-4 w-4" />
                미리보기
            </Button>
        </div>
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
            <span class="text-muted-foreground ml-2 text-sm">로딩 중...</span>
        </div>
    {:else if !content}
        <Card.Root>
            <Card.Content class="py-12 text-center">
                <p class="text-muted-foreground">콘텐츠를 찾을 수 없습니다.</p>
                <Button variant="outline" class="mt-4" onclick={() => goto('/admin/contents')}>
                    목록으로 돌아가기
                </Button>
            </Card.Content>
        </Card.Root>
    {:else}
        <form
            class="space-y-6"
            onsubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
        >
            <!-- 기본 정보 -->
            <Card.Root>
                <Card.Header>
                    <Card.Title class="text-base">기본 정보</Card.Title>
                </Card.Header>
                <Card.Content class="space-y-4">
                    <div class="grid gap-2">
                        <Label for="subject">제목</Label>
                        <Input
                            id="subject"
                            bind:value={formSubject}
                            placeholder="페이지 제목"
                            disabled={saving}
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="seo-title">SEO 타이틀</Label>
                        <Input
                            id="seo-title"
                            bind:value={formSeoTitle}
                            placeholder="브라우저 탭에 표시될 제목 (비워두면 제목 사용)"
                            disabled={saving}
                        />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="level">접근 레벨</Label>
                            <Input
                                id="level"
                                type="number"
                                min="0"
                                max="10"
                                bind:value={formLevel}
                                disabled={saving}
                            />
                            <p class="text-muted-foreground text-xs">
                                0=전체, 1~9=해당 레벨 이상, 10=관리자만
                            </p>
                        </div>
                        <div class="flex items-center gap-3 pt-6">
                            <Switch bind:checked={formHtml} disabled={saving} />
                            <Label class="text-sm">HTML 허용</Label>
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- 콘텐츠 편집 -->
            <Card.Root>
                <Card.Header>
                    <Card.Title class="text-base">콘텐츠</Card.Title>
                </Card.Header>
                <Card.Content class="space-y-4">
                    <div class="grid gap-2">
                        <Label for="content">PC 콘텐츠</Label>
                        <Textarea
                            id="content"
                            bind:value={formContent}
                            placeholder="HTML 콘텐츠를 입력하세요..."
                            disabled={saving}
                            rows={20}
                            class="font-mono text-sm"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="mobile-content">모바일 콘텐츠 (선택)</Label>
                        <Textarea
                            id="mobile-content"
                            bind:value={formMobileContent}
                            placeholder="모바일 전용 콘텐츠 (비워두면 PC 콘텐츠 사용)"
                            disabled={saving}
                            rows={10}
                            class="font-mono text-sm"
                        />
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- 저장 버튼 -->
            <div class="flex justify-end gap-2">
                <Button variant="outline" type="button" onclick={() => goto('/admin/contents')}>
                    취소
                </Button>
                <Button type="submit" disabled={saving}>
                    {#if saving}
                        <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                        저장 중...
                    {:else}
                        <Save class="mr-1.5 h-4 w-4" />
                        저장
                    {/if}
                </Button>
            </div>
        </form>
    {/if}
</div>
