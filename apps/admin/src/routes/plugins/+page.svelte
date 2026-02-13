<script lang="ts">
    import { onMount } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin-store.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Toaster } from '$lib/components/ui/sonner';
    import PluginUploader from '$lib/components/plugin-uploader.svelte';
    import { Trash2 } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';

    // Store에서 플러그인 목록 가져오기
    const plugins = $derived(pluginStore.plugins);

    // 페이지 로드 시 Web API에서 플러그인 목록 가져오기
    onMount(() => {
        pluginStore.loadPlugins();
    });

    // 상태별 Badge variant 매핑
    function getStatusVariant(status: string) {
        switch (status) {
            case 'active':
                return 'default';
            case 'inactive':
                return 'secondary';
            case 'installing':
                return 'outline';
            case 'error':
                return 'destructive';
            default:
                return 'secondary';
        }
    }

    // 상태 번역
    function getStatusLabel(status: string) {
        switch (status) {
            case 'active':
                return '활성';
            case 'inactive':
                return '비활성';
            case 'installing':
                return '설치 중';
            case 'error':
                return '오류';
            default:
                return status;
        }
    }

    // 플러그인 삭제
    async function deletePlugin(pluginId: string, pluginName: string) {
        if (!confirm(`플러그인 "${pluginName}"을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5173/api/plugins/${pluginId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success('플러그인이 삭제되었습니다.');
                pluginStore.loadPlugins();
            } else {
                toast.error(result.error || '플러그인 삭제에 실패했습니다.');
            }
        } catch (error) {
            toast.error('플러그인 삭제 중 오류가 발생했습니다.');
            console.error('Plugin deletion error:', error);
        }
    }

    // 업로드 성공 콜백
    function handleUploadSuccess() {
        pluginStore.loadPlugins(); // 플러그인 목록 새로고침
    }
</script>

<Toaster />

<div class="container mx-auto p-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold">플러그인 관리</h1>
        <p class="text-muted-foreground mt-2">플러그인을 설치하고 관리하세요</p>
    </div>

    <!-- 상단 액션 바 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex gap-2">
            <PluginUploader onUploadSuccess={handleUploadSuccess} />
            <Button variant="outline" href="/plugins/marketplace">마켓플레이스</Button>
        </div>
        <div class="text-muted-foreground text-sm">
            설치된 플러그인: {plugins.length}
        </div>
    </div>

    <!-- 플러그인 목록 -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each plugins as plugin (plugin.manifest.id)}
            <Card class="overflow-hidden">
                <!-- 스크린샷 영역 -->
                {#if plugin.manifest.screenshot}
                    <div class="bg-muted aspect-video">
                        <img
                            src={plugin.manifest.screenshot}
                            alt={plugin.manifest.name}
                            class="h-full w-full object-cover"
                        />
                    </div>
                {:else}
                    <div class="bg-muted flex aspect-video items-center justify-center">
                        <span class="text-muted-foreground text-sm">미리보기 없음</span>
                    </div>
                {/if}

                <CardHeader>
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="mb-2 flex items-center gap-2">
                                <CardTitle>{plugin.manifest.name}</CardTitle>
                                <!-- 출처 배지 -->
                                {#if plugin.source === 'official'}
                                    <Badge variant="default" class="text-xs">공식</Badge>
                                {:else if plugin.source === 'custom'}
                                    <Badge variant="secondary" class="text-xs">커스텀</Badge>
                                {/if}
                            </div>
                            <CardDescription class="mt-1">
                                v{plugin.manifest.version} · {plugin.manifest.author.name}
                            </CardDescription>
                        </div>
                        <Badge variant={getStatusVariant(plugin.status)}>
                            {getStatusLabel(plugin.status)}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent>
                    <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                        {plugin.manifest.description}
                    </p>

                    <!-- 태그 -->
                    {#if plugin.manifest.tags && plugin.manifest.tags.length > 0}
                        <div class="mb-4 flex flex-wrap gap-1">
                            {#each plugin.manifest.tags.slice(0, 3) as tag (tag)}
                                <Badge variant="outline" class="text-xs">{tag}</Badge>
                            {/each}
                        </div>
                    {/if}

                    <!-- 통계 -->
                    <div class="text-muted-foreground mb-4 flex gap-4 text-xs">
                        {#if plugin.downloadCount}
                            <span>다운로드: {plugin.downloadCount.toLocaleString()}</span>
                        {/if}
                        {#if plugin.manifest.hooks && plugin.manifest.hooks.length > 0}
                            <span>Hooks: {plugin.manifest.hooks.length}</span>
                        {/if}
                        {#if plugin.manifest.components && plugin.manifest.components.length > 0}
                            <span>Components: {plugin.manifest.components.length}</span>
                        {/if}
                    </div>

                    <!-- 액션 버튼 -->
                    <div class="flex gap-2">
                        {#if plugin.status === 'active'}
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                onclick={() => pluginStore.deactivatePlugin(plugin.manifest.id)}
                                disabled={pluginStore.isPluginLoading(plugin.manifest.id)}
                            >
                                {pluginStore.isActionInProgress(plugin.manifest.id, 'deactivate')
                                    ? '처리 중...'
                                    : '비활성화'}
                            </Button>
                        {:else if plugin.status === 'inactive'}
                            <Button
                                size="sm"
                                class="flex-1"
                                onclick={() => pluginStore.activatePlugin(plugin.manifest.id)}
                                disabled={pluginStore.isPluginLoading(plugin.manifest.id)}
                            >
                                {pluginStore.isActionInProgress(plugin.manifest.id, 'activate')
                                    ? '처리 중...'
                                    : '활성화'}
                            </Button>
                            <!-- 커스텀 플러그인만 삭제 버튼 표시 -->
                            {#if plugin.source === 'custom'}
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    class="flex-shrink-0"
                                    onclick={() =>
                                        deletePlugin(plugin.manifest.id, plugin.manifest.name)}
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            {/if}
                        {:else if plugin.status === 'installing'}
                            <Button disabled size="sm" class="flex-1">설치 중...</Button>
                        {:else if plugin.status === 'error'}
                            <Button variant="destructive" size="sm" class="flex-1" disabled>
                                오류 발생
                            </Button>
                        {/if}
                    </div>

                    <!-- 에러 메시지 -->
                    {#if plugin.status === 'error' && plugin.errorMessage}
                        <div class="bg-destructive/10 text-destructive mt-3 rounded-md p-2 text-xs">
                            {plugin.errorMessage}
                        </div>
                    {/if}
                </CardContent>
            </Card>
        {/each}
    </div>
</div>
