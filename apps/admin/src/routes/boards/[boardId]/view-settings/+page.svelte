<script lang="ts">
    /**
     * 게시판 레이아웃 설정 페이지
     *
     * 관리자가 각 게시판의 목록/본문 레이아웃과 표시 옵션을 설정합니다.
     * v2_board_display_settings 테이블에 저장됩니다.
     */

    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Switch } from '$lib/components/ui/switch';
    import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
    import { toast } from 'svelte-sonner';
    import { Toaster } from '$lib/components/ui/sonner';
    import {
        ChevronLeft,
        Save,
        List,
        LayoutGrid,
        Image,
        AlignJustify,
        Newspaper
    } from '@lucide/svelte';
    import {
        getDisplaySettings,
        updateDisplaySettings,
        type BoardDisplaySettings
    } from '$lib/api/board-display-settings';

    type ListLayoutId = 'compact' | 'card' | 'detailed' | 'gallery' | 'webzine';

    interface LayoutOption {
        id: ListLayoutId;
        label: string;
        description: string;
        icon: typeof List;
    }

    const boardId = $derived($page.params.boardId || '');

    const listLayouts: LayoutOption[] = [
        { id: 'compact', label: '컴팩트', description: '밀집된 텍스트 목록 (기본)', icon: AlignJustify },
        { id: 'card', label: '카드', description: '카드 그리드 형태', icon: LayoutGrid },
        { id: 'detailed', label: '상세', description: '미리보기 포함 리스트', icon: List },
        { id: 'gallery', label: '갤러리', description: '이미지 중심 그리드', icon: Image },
        { id: 'webzine', label: '웹진', description: '블로그/뉴스 스타일', icon: Newspaper }
    ];

    let listLayout = $state<ListLayoutId>('compact');
    let showPreview = $state(false);
    let previewLength = $state(150);
    let showThumbnail = $state(false);
    let isLoading = $state(false);
    let isSaving = $state(false);
    let loaded = $state(false);

    onMount(async () => {
        await loadSettings();
    });

    async function loadSettings() {
        isLoading = true;
        try {
            const settings = await getDisplaySettings(boardId);
            listLayout = (settings.list_layout || 'compact') as ListLayoutId;
            showPreview = settings.show_preview ?? false;
            previewLength = settings.preview_length || 150;
            showThumbnail = settings.show_thumbnail ?? false;
            loaded = true;
        } catch (error) {
            console.error('Failed to load display settings:', error);
            toast.error('설정을 불러오는데 실패했습니다.');
            loaded = true;
        } finally {
            isLoading = false;
        }
    }

    async function saveSettings() {
        isSaving = true;
        try {
            await updateDisplaySettings(boardId, {
                list_layout: listLayout,
                show_preview: showPreview,
                preview_length: previewLength,
                show_thumbnail: showThumbnail
            });
            toast.success('레이아웃 설정이 저장되었습니다.');
        } catch (error) {
            console.error('Failed to save display settings:', error);
            if (error instanceof Error && error.message.includes('401')) {
                toast.error('인증이 필요합니다. 다시 로그인해주세요.');
            } else if (error instanceof Error && error.message.includes('403')) {
                toast.error('관리자 권한이 필요합니다.');
            } else {
                toast.error('설정 저장에 실패했습니다.');
            }
        } finally {
            isSaving = false;
        }
    }
</script>

<Toaster />

<div class="container mx-auto max-w-4xl py-8">
    <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" href="/boards">
                <ChevronLeft class="h-5 w-5" />
            </Button>
            <div>
                <h1 class="text-3xl font-bold">게시판 레이아웃 설정</h1>
                <p class="text-muted-foreground">게시판 "{boardId}"의 표시 방식을 설정합니다.</p>
            </div>
        </div>
        <Button onclick={saveSettings} disabled={isSaving || isLoading}>
            <Save class="mr-2 h-4 w-4" />
            {isSaving ? '저장 중...' : '저장'}
        </Button>
    </div>

    {#if isLoading && !loaded}
        <div class="flex items-center justify-center py-12">
            <p class="text-muted-foreground">설정 불러오는 중...</p>
        </div>
    {:else}
        <div class="space-y-6">
            <!-- 목록 레이아웃 선택 -->
            <Card>
                <CardHeader>
                    <CardTitle>목록 레이아웃</CardTitle>
                    <CardDescription>
                        게시판 목록 페이지에서 사용할 레이아웃을 선택합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    {#each listLayouts as layout (layout.id)}
                        {@const Icon = layout.icon}
                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors {listLayout ===
                            layout.id
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'}"
                            onclick={() => (listLayout = layout.id)}
                        >
                            <div
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md {listLayout ===
                                layout.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'}"
                            >
                                <Icon class="h-5 w-5" />
                            </div>
                            <div class="flex-1">
                                <p class="font-medium">{layout.label}</p>
                                <p class="text-muted-foreground text-sm">{layout.description}</p>
                            </div>
                            {#if listLayout === layout.id}
                                <span class="text-primary text-sm font-medium">선택됨</span>
                            {/if}
                        </button>
                    {/each}
                </CardContent>
            </Card>

            <!-- 표시 옵션 -->
            <Card>
                <CardHeader>
                    <CardTitle>표시 옵션</CardTitle>
                    <CardDescription>목록에서의 추가 표시 옵션을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-6">
                    <!-- 본문 미리보기 -->
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium">본문 미리보기</p>
                            <p class="text-muted-foreground text-sm">
                                목록에서 게시글 본문 일부를 미리 표시합니다.
                            </p>
                        </div>
                        <Switch
                            checked={showPreview}
                            onCheckedChange={(v) => (showPreview = v)}
                        />
                    </div>

                    {#if showPreview}
                        <div class="ml-4 border-l-2 pl-4">
                            <label class="text-sm font-medium" for="preview-length">
                                미리보기 글자 수
                            </label>
                            <Select
                                type="single"
                                value={String(previewLength)}
                                onValueChange={(v) => (previewLength = Number(v))}
                            >
                                <SelectTrigger id="preview-length" class="mt-1 w-32">
                                    {previewLength}자
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="50">50자</SelectItem>
                                    <SelectItem value="100">100자</SelectItem>
                                    <SelectItem value="150">150자</SelectItem>
                                    <SelectItem value="200">200자</SelectItem>
                                    <SelectItem value="300">300자</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    {/if}

                    <!-- 썸네일 표시 -->
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium">썸네일 이미지</p>
                            <p class="text-muted-foreground text-sm">
                                목록에서 게시글의 첫 번째 이미지를 썸네일로 표시합니다.
                            </p>
                        </div>
                        <Switch
                            checked={showThumbnail}
                            onCheckedChange={(v) => (showThumbnail = v)}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    {/if}
</div>
