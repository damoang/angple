<script lang="ts">
    import { onMount } from 'svelte';
    import { pluginStore } from '$lib/stores/admin-plugin-store.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { Toaster } from '$lib/components/ui/sonner';
    import { Trash2, Settings, Plug, Github } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';
    import { t } from '$lib/i18n';
    import PluginGithubInstaller from '$lib/components/admin/plugin-github-installer.svelte';
    import BackendPluginStore from '$lib/components/admin/backend-plugin-store.svelte';

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
                return t('common_activate');
            case 'inactive':
                return t('common_deactivate');
            case 'installing':
                return t('common_loading');
            case 'error':
                return t('error_general');
            default:
                return status;
        }
    }

    // 플러그인 삭제
    async function deletePlugin(pluginId: string, pluginName: string) {
        if (!confirm(t('admin_plugins_deleteConfirm'))) {
            return;
        }

        await pluginStore.deletePlugin(pluginId);
    }
</script>

<svelte:head>
    <title>플러그인 관리 - 관리자</title>
</svelte:head>

<Toaster />

<div class="container mx-auto p-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold">{t('admin_plugins_title')}</h1>
        <p class="text-muted-foreground mt-2">{t('admin_plugins_noPlugins')}</p>
    </div>

    <Tabs value="backend" class="w-full">
        <TabsList class="mb-6">
            <TabsTrigger value="backend">백엔드 플러그인</TabsTrigger>
            <TabsTrigger value="frontend">프론트엔드 플러그인</TabsTrigger>
        </TabsList>

        <TabsContent value="backend">
            <BackendPluginStore />
        </TabsContent>

        <TabsContent value="frontend">
            <!-- 상단 액션 바 -->
            <div class="mb-6 flex items-center justify-between">
                <div class="flex gap-2">
                    <Button variant="outline" disabled>
                        <Plug class="mr-2 h-4 w-4" />
                        {t('admin_plugins_upload')}
                    </Button>
                    <PluginGithubInstaller onInstallSuccess={() => pluginStore.loadPlugins()} />
                    <Button variant="outline" href="/admin/plugins/marketplace">
                        {t('admin_plugins_marketplace')}
                    </Button>
                </div>
                <div class="text-muted-foreground text-sm">
                    {t('admin_plugins_installed')}: {plugins.length} ({t('admin_plugins_active')}: {plugins.filter(
                        (p) => p.status === 'active'
                    ).length})
                </div>
            </div>

            <!--
                반영 시점 안내.

                끄기가 "안 먹는" 것처럼 보이는 일이 반복돼 넣었다(2026-08-04 폭죽 건).
                서버·DB 는 즉시 바뀐다. 바뀌지 않는 건 **이미 열려 있는 브라우저 탭** 이다 —
                body-end 슬롯에 상주하는 컴포넌트는 onMount 가 탭당 한 번만 돌아
                끈 뒤에도 새로고침 전까지 그대로 살아 있다.

                ⛔ "적용까지 시간이 걸립니다" 같은 뭉뚱그린 문구를 쓰지 말 것.
                   원인이 시간이 아니라 탭이라 그렇게 쓰면 계속 기다리게 된다.
            -->
            <div
                class="mb-6 rounded-lg border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/25"
            >
                <p class="font-medium">플러그인을 켜고 끈 뒤에는 새로고침이 필요합니다.</p>
                <p class="text-muted-foreground mt-1">
                    변경은 서버에 즉시 저장되지만, <strong>이미 열려 있는 탭</strong>에는 반영되지
                    않습니다. 화면에서 확인하실 때는 해당 탭을 새로고침해 주세요.
                </p>
            </div>

            <!-- 플러그인 목록 -->
            {#if plugins.length === 0 && !pluginStore.isLoading}
                <Card>
                    <CardContent class="py-12 text-center">
                        <div class="mb-4 text-6xl">🔌</div>
                        <h2 class="mb-2 text-xl font-semibold">{t('admin_plugins_noPlugins')}</h2>
                        <p class="text-muted-foreground">
                            {t('admin_plugins_noPlugins')}
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
                                    <Plug class="text-muted-foreground h-12 w-12" />
                                </div>
                            {/if}

                            <CardHeader>
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <div class="mb-2 flex items-center gap-2">
                                            <CardTitle>{plugin.manifest.name}</CardTitle>
                                            <!-- 출처 배지 -->
                                            {#if plugin.source === 'official'}
                                                <Badge variant="default" class="text-xs"
                                                    >{t('admin_themes_official')}</Badge
                                                >
                                            {:else if plugin.source === 'custom'}
                                                <Badge variant="secondary" class="text-xs"
                                                    >{t('admin_themes_custom')}</Badge
                                                >
                                            {/if}
                                        </div>
                                        <CardDescription class="mt-1">
                                            v{plugin.manifest.version} · {plugin.manifest.author
                                                .name}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={getStatusVariant(plugin.status)}>
                                        {getStatusLabel(plugin.status)}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent>
                                <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                                    {plugin.manifest.description || t('plugin_description')}
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
                                        <span>Components: {plugin.manifest.components.length}</span>
                                    {/if}
                                    {#if plugin.manifest.hooks}
                                        <span>Hooks: {plugin.manifest.hooks.length}</span>
                                    {/if}
                                </div>

                                <!-- 액션 버튼 -->
                                <div class="flex gap-2">
                                    {#if plugin.status === 'active'}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="flex-1"
                                            href={`/admin/plugins/${plugin.manifest.id}/settings`}
                                        >
                                            <Settings class="mr-1 h-3 w-3" />
                                            {t('common_settings')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="flex-1"
                                            disabled={pluginStore.isPluginLoading(
                                                plugin.manifest.id
                                            )}
                                            onclick={() =>
                                                pluginStore.deactivatePlugin(plugin.manifest.id)}
                                        >
                                            {pluginStore.isActionInProgress(
                                                plugin.manifest.id,
                                                'deactivate'
                                            )
                                                ? t('common_loading')
                                                : t('common_deactivate')}
                                        </Button>
                                    {:else if plugin.status === 'inactive'}
                                        <Button
                                            size="sm"
                                            class="flex-1"
                                            disabled={pluginStore.isPluginLoading(
                                                plugin.manifest.id
                                            )}
                                            onclick={() =>
                                                pluginStore.activatePlugin(plugin.manifest.id)}
                                        >
                                            {pluginStore.isActionInProgress(
                                                plugin.manifest.id,
                                                'activate'
                                            )
                                                ? t('common_loading')
                                                : t('common_activate')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="flex-1"
                                            href={`/admin/plugins/${plugin.manifest.id}/settings`}
                                        >
                                            <Settings class="mr-1 h-3 w-3" />
                                            {t('common_settings')}
                                        </Button>
                                        <!-- 커스텀 플러그인만 삭제 버튼 표시 -->
                                        {#if plugin.source === 'custom'}
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                class="flex-shrink-0"
                                                onclick={() =>
                                                    deletePlugin(
                                                        plugin.manifest.id,
                                                        plugin.manifest.name
                                                    )}
                                            >
                                                <Trash2 class="h-4 w-4" />
                                            </Button>
                                        {/if}
                                    {:else if plugin.status === 'installing'}
                                        <Button disabled size="sm" class="flex-1"
                                            >{t('common_loading')}</Button
                                        >
                                    {:else if plugin.status === 'error'}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            class="flex-1"
                                            disabled
                                        >
                                            {t('common_refresh')}
                                        </Button>
                                    {/if}
                                </div>

                                <!-- 에러 메시지 -->
                                {#if plugin.status === 'error' && plugin.errorMessage}
                                    <div
                                        class="bg-destructive/10 text-destructive mt-3 rounded-md p-2 text-xs"
                                    >
                                        {plugin.errorMessage}
                                    </div>
                                {/if}
                            </CardContent>
                        </Card>
                    {/each}
                </div>
            {/if}
        </TabsContent>
    </Tabs>
</div>
