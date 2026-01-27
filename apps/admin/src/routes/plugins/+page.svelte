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
    import { Trash2, Settings, Plug } from '@lucide/svelte';
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

    // 상태 한글 변환
    function getStatusLabel(status: string) {
        switch (status) {
            case 'active':
                return '활성화';
            case 'inactive':
                return '비활성화';
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
        if (!confirm(`정말로 "${pluginName}" 플러그인을 삭제하시겠습니까?`)) {
            return;
        }

        await pluginStore.deletePlugin(pluginId);
    }
</script>

<Toaster />

<div class="container mx-auto p-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold">플러그인 관리</h1>
        <p class="text-muted-foreground mt-2">설치된 플러그인을 관리하고 새로운 플러그인을 추가하세요.</p>
    </div>

    <!-- 상단 액션 바 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex gap-2">
            <Button variant="outline" disabled>
                <Plug class="mr-2 h-4 w-4" />
                플러그인 업로드
            </Button>
            <Button variant="outline" disabled>마켓플레이스</Button>
        </div>
        <div class="text-muted-foreground text-sm">
            총 {plugins.length}개 플러그인 (활성: {plugins.filter((p) => p.status === 'active').length}개)
        </div>
    </div>

    <!-- 플러그인 목록 -->
    {#if plugins.length === 0 && !pluginStore.isLoading}
        <Card>
            <CardContent class="py-12 text-center">
                <div class="mb-4 text-6xl">🔌</div>
                <h2 class="text-xl font-semibold mb-2">설치된 플러그인이 없습니다</h2>
                <p class="text-muted-foreground">
                    plugins/ 디렉터리에 플러그인을 추가하면 여기에 표시됩니다.
                </p>
            </CardContent>
        </Card>
    {:else}
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
                            <Plug class="h-12 w-12 text-muted-foreground" />
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
                            {plugin.manifest.description || '설명 없음'}
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
                            {#if plugin.manifest.components}
                                <span>컴포넌트 {plugin.manifest.components.length}개</span>
                            {/if}
                            {#if plugin.manifest.hooks}
                                <span>훅 {plugin.manifest.hooks.length}개</span>
                            {/if}
                        </div>

                        <!-- 액션 버튼 -->
                        <div class="flex gap-2">
                            {#if plugin.status === 'active'}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    href={`/plugins/${plugin.manifest.id}/settings`}
                                >
                                    <Settings class="mr-1 h-3 w-3" />
                                    설정
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    disabled={pluginStore.isPluginLoading(plugin.manifest.id)}
                                    onclick={() => pluginStore.deactivatePlugin(plugin.manifest.id)}
                                >
                                    {pluginStore.isActionInProgress(plugin.manifest.id, 'deactivate')
                                        ? '처리 중...'
                                        : '비활성화'}
                                </Button>
                            {:else if plugin.status === 'inactive'}
                                <Button
                                    size="sm"
                                    class="flex-1"
                                    disabled={pluginStore.isPluginLoading(plugin.manifest.id)}
                                    onclick={() => pluginStore.activatePlugin(plugin.manifest.id)}
                                >
                                    {pluginStore.isActionInProgress(plugin.manifest.id, 'activate')
                                        ? '처리 중...'
                                        : '활성화'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    href={`/plugins/${plugin.manifest.id}/settings`}
                                >
                                    <Settings class="mr-1 h-3 w-3" />
                                    설정
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
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    class="flex-1"
                                    disabled
                                >
                                    재시도
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
    {/if}
</div>
