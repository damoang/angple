<script lang="ts">
    import { onMount } from 'svelte';
    import { widgetStore } from '$lib/stores/admin-widget-store.svelte';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import {
        Save,
        RotateCcw,
        Plus,
        ExternalLink,
        Package,
        Layout,
        Trash2
    } from '@lucide/svelte/icons';
    import { toast } from 'svelte-sonner';

    import WidgetListTable from '$lib/components/admin/widgets/widget-list-table.svelte';
    import WidgetDetailsPanel from '$lib/components/admin/widgets/widget-details-panel.svelte';
    import AddWidgetDialog from '$lib/components/admin/widgets/add-widget-dialog.svelte';
    import ZoneTabs from '$lib/components/admin/widgets/zone-tabs.svelte';
    import WidgetUploader from '$lib/components/admin/widget-uploader.svelte';

    /**
     * 위젯 관리 페이지
     *
     * 메인 영역과 사이드바 위젯을 드래그앤드롭으로 관리합니다.
     * 설치된 위젯 마켓플레이스 기능도 포함합니다.
     */

    // 상태
    let isAddDialogOpen = $state(false);
    let activeTab = $state<'layout' | 'installed'>('layout');

    /** 설치된 위젯 목록 (API에서 가져옴) */
    interface InstalledWidget {
        id: string;
        name: string;
        version: string;
        description?: string;
        author: { name: string; email?: string; url?: string };
        category: string;
        slots: string[];
        isCustom: boolean;
    }

    let installedWidgets = $state<InstalledWidget[]>([]);
    let isLoadingInstalled = $state(false);
    let widgetCount = $state({ total: 0, official: 0, custom: 0 });

    // 파생 상태
    const isLoading = $derived(widgetStore.isLoading);
    const isSaving = $derived(widgetStore.isSaving);
    const hasChanges = $derived(widgetStore.hasChanges);
    const selectedZone = $derived(widgetStore.selectedZone);
    const widgets = $derived(widgetStore.currentWidgets);
    const selectedWidget = $derived(widgetStore.selectedWidget);

    // 초기 로드
    onMount(() => {
        widgetStore.loadWidgets();
        loadInstalledWidgets();
    });

    /** 설치된 위젯 목록 로드 */
    async function loadInstalledWidgets() {
        isLoadingInstalled = true;
        try {
            const response = await fetch('/api/widgets');
            const data = await response.json();

            if (data.success) {
                installedWidgets = data.widgets;
                widgetCount = data.count;
            } else {
                toast.error('위젯 목록을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to load installed widgets:', error);
            toast.error('위젯 목록을 불러오는데 실패했습니다.');
        } finally {
            isLoadingInstalled = false;
        }
    }

    /** 위젯 삭제 */
    async function deleteWidget(widgetId: string, widgetName: string) {
        if (!confirm(`정말로 "${widgetName}" 위젯을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/widgets/${widgetId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success('위젯이 성공적으로 삭제되었습니다.');
                loadInstalledWidgets(); // 목록 새로고침
            } else {
                toast.error(result.error || '위젯 삭제 중 오류가 발생했습니다.');
            }
        } catch (error) {
            toast.error('위젯 삭제 중 오류가 발생했습니다.');
            console.error('Widget deletion error:', error);
        }
    }

    /** 업로드 성공 콜백 */
    function handleUploadSuccess() {
        loadInstalledWidgets(); // 위젯 목록 새로고침
    }

    /** 카테고리 한글 변환 */
    function getCategoryLabel(category: string): string {
        const labels: Record<string, string> = {
            content: '콘텐츠',
            sidebar: '사이드바',
            ad: '광고',
            social: '소셜',
            utility: '유틸리티',
            layout: '레이아웃'
        };
        return labels[category] || category;
    }

    /** 슬롯 한글 변환 */
    function getSlotLabel(slot: string): string {
        const labels: Record<string, string> = {
            main: '메인',
            sidebar: '사이드바',
            header: '헤더',
            footer: '푸터'
        };
        return labels[slot] || slot;
    }

    // 저장 핸들러
    async function handleSave() {
        await widgetStore.saveWidgets();
    }

    // 취소 핸들러
    function handleDiscard() {
        widgetStore.discardChanges();
        toast.info('변경사항이 취소되었습니다.');
    }

    // 위젯 추가 핸들러
    function handleAddWidget() {
        isAddDialogOpen = true;
    }

    // Web 앱 열기
    function openWebApp() {
        window.open('/', '_blank');
    }
</script>

<svelte:head>
    <title>위젯 관리 - 관리자</title>
</svelte:head>

<div class="flex h-full flex-col">
    <!-- 헤더 -->
    <header class="bg-background border-border border-b px-6 py-4">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold">위젯 관리</h1>
                <p class="text-muted-foreground text-sm">
                    위젯 레이아웃을 관리하고 새로운 위젯을 설치하세요
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" onclick={openWebApp}>
                    <ExternalLink class="mr-2 h-4 w-4" />
                    미리보기
                </Button>
            </div>
        </div>
    </header>

    <!-- 탭 기반 콘텐츠 -->
    <Tabs bind:value={activeTab} class="flex flex-1 flex-col overflow-hidden">
        <div class="bg-background border-border border-b px-6">
            <TabsList class="mt-2">
                <TabsTrigger value="layout" class="gap-2">
                    <Layout class="h-4 w-4" />
                    레이아웃 관리
                </TabsTrigger>
                <TabsTrigger value="installed" class="gap-2">
                    <Package class="h-4 w-4" />
                    설치된 위젯
                    <Badge variant="secondary" class="ml-1">{widgetCount.total}</Badge>
                </TabsTrigger>
            </TabsList>
        </div>

        <!-- 레이아웃 관리 탭 -->
        <TabsContent value="layout" class="m-0 flex flex-1 overflow-hidden">
            <div class="flex flex-1 flex-col overflow-hidden">
                <!-- 레이아웃 관리 액션 바 -->
                <div class="bg-background flex items-center justify-between px-6 py-3">
                    <ZoneTabs />
                    <div class="flex items-center gap-2">
                        {#if hasChanges}
                            <Badge variant="secondary">변경사항 있음</Badge>
                        {/if}
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={handleDiscard}
                            disabled={!hasChanges || isSaving}
                        >
                            <RotateCcw class="mr-2 h-4 w-4" />
                            취소
                        </Button>
                        <Button size="sm" onclick={handleSave} disabled={!hasChanges || isSaving}>
                            <Save class="mr-2 h-4 w-4" />
                            {isSaving ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                </div>

                <!-- 레이아웃 콘텐츠 -->
                <div class="flex flex-1 overflow-hidden">
                    <div class="flex-1 overflow-auto p-6">
                        {#if isLoading}
                            <Card>
                                <CardContent class="py-10">
                                    <div class="text-muted-foreground text-center">
                                        위젯 레이아웃을 불러오는 중...
                                    </div>
                                </CardContent>
                            </Card>
                        {:else if widgets.length === 0}
                            <Card>
                                <CardContent class="py-10">
                                    <div class="text-center">
                                        <p class="text-muted-foreground mb-4">
                                            {selectedZone === 'main' ? '메인 영역' : '사이드바'}에
                                            등록된 위젯이 없습니다.
                                        </p>
                                        <Button onclick={handleAddWidget}>
                                            <Plus class="mr-2 h-4 w-4" />
                                            첫 위젯 추가하기
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        {:else}
                            <Card>
                                <CardHeader>
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <CardTitle>
                                                {selectedZone === 'main' ? '메인 영역' : '사이드바'}
                                                위젯
                                            </CardTitle>
                                            <CardDescription>
                                                드래그하여 순서를 변경하고, 토글로 활성화/비활성화할
                                                수 있습니다
                                            </CardDescription>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onclick={handleAddWidget}
                                        >
                                            <Plus class="mr-2 h-4 w-4" />
                                            위젯 추가
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <WidgetListTable />
                                </CardContent>
                            </Card>
                        {/if}
                    </div>

                    <!-- 사이드 패널 (위젯 상세) -->
                    {#if selectedWidget}
                        <WidgetDetailsPanel />
                    {/if}
                </div>
            </div>
        </TabsContent>

        <!-- 설치된 위젯 탭 -->
        <TabsContent value="installed" class="m-0 flex-1 overflow-auto p-6">
            <!-- 상단 액션 바 -->
            <div class="mb-6 flex items-center justify-between">
                <div class="flex gap-2">
                    <WidgetUploader onUploadSuccess={handleUploadSuccess} />
                </div>
                <div class="text-muted-foreground flex items-center gap-4 text-sm">
                    <span>공식 {widgetCount.official}개</span>
                    <span>커스텀 {widgetCount.custom}개</span>
                </div>
            </div>

            <!-- 위젯 목록 -->
            {#if isLoadingInstalled}
                <Card>
                    <CardContent class="py-10">
                        <div class="text-muted-foreground text-center">
                            설치된 위젯을 불러오는 중...
                        </div>
                    </CardContent>
                </Card>
            {:else if installedWidgets.length === 0}
                <Card>
                    <CardContent class="py-10">
                        <div class="text-center">
                            <Package class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                            <p class="text-muted-foreground mb-4">설치된 위젯이 없습니다.</p>
                            <WidgetUploader onUploadSuccess={handleUploadSuccess} />
                        </div>
                    </CardContent>
                </Card>
            {:else}
                <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {#each installedWidgets as widget (widget.id)}
                        <Card class="overflow-hidden">
                            <CardHeader>
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <div class="mb-2 flex items-center gap-2">
                                            <CardTitle class="text-lg">{widget.name}</CardTitle>
                                            <!-- 출처 배지 -->
                                            {#if widget.isCustom}
                                                <Badge variant="secondary" class="text-xs"
                                                    >커스텀</Badge
                                                >
                                            {:else}
                                                <Badge variant="default" class="text-xs">공식</Badge
                                                >
                                            {/if}
                                        </div>
                                        <CardDescription>
                                            v{widget.version} · {widget.author.name}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline"
                                        >{getCategoryLabel(widget.category)}</Badge
                                    >
                                </div>
                            </CardHeader>

                            <CardContent>
                                {#if widget.description}
                                    <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                                        {widget.description}
                                    </p>
                                {/if}

                                <!-- 슬롯 태그 -->
                                <div class="mb-4 flex flex-wrap gap-1">
                                    {#each widget.slots as slot (slot)}
                                        <Badge variant="outline" class="text-xs"
                                            >{getSlotLabel(slot)}</Badge
                                        >
                                    {/each}
                                </div>

                                <!-- 액션 버튼 -->
                                <div class="flex gap-2">
                                    <Button variant="outline" size="sm" class="flex-1" disabled>
                                        설정
                                    </Button>
                                    <!-- 커스텀 위젯만 삭제 버튼 표시 -->
                                    {#if widget.isCustom}
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            class="flex-shrink-0"
                                            onclick={() => deleteWidget(widget.id, widget.name)}
                                        >
                                            <Trash2 class="h-4 w-4" />
                                        </Button>
                                    {/if}
                                </div>
                            </CardContent>
                        </Card>
                    {/each}
                </div>
            {/if}
        </TabsContent>
    </Tabs>
</div>

<!-- 위젯 추가 다이얼로그 -->
<AddWidgetDialog bind:open={isAddDialogOpen} />
