<script lang="ts">
    import { onMount } from 'svelte';
    import * as pluginStoreApi from '$lib/api/plugin-store';
    import type { CatalogPlugin, PluginEvent } from '$lib/api/plugin-store';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogDescription
    } from '$lib/components/ui/dialog';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import { toast } from 'svelte-sonner';
    import {
        Settings,
        Power,
        PowerOff,
        Trash2,
        History,
        Download,
        RefreshCw
    } from '@lucide/svelte';

    let plugins = $state<CatalogPlugin[]>([]);
    let loading = $state(true);
    let actionLoading = $state<Record<string, boolean>>({});

    // 설정 모달
    let showSettings = $state(false);
    let selectedPlugin = $state<CatalogPlugin | null>(null);
    let settingValues = $state<Record<string, unknown>>({});
    let settingsSchema = $state<
        Array<{ key: string; label: string; type: string; value: unknown; default_value: unknown }>
    >([]);

    // 이벤트 모달
    let showEvents = $state(false);
    let events = $state<PluginEvent[]>([]);

    onMount(() => {
        loadPlugins();
    });

    async function loadPlugins() {
        loading = true;
        try {
            plugins = await pluginStoreApi.listPlugins();
        } catch (e) {
            console.error('플러그인 목록 로드 실패:', e);
            toast.error(
                '백엔드 플러그인 목록을 불러오지 못했습니다. API 서버가 실행 중인지 확인하세요.'
            );
        } finally {
            loading = false;
        }
    }

    async function install(name: string) {
        actionLoading[name] = true;
        try {
            await pluginStoreApi.installPlugin(name);
            toast.success('플러그인이 설치되었습니다.');
            await loadPlugins();
        } catch (e: unknown) {
            toast.error('설치 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        } finally {
            actionLoading[name] = false;
        }
    }

    async function enable(name: string) {
        actionLoading[name] = true;
        try {
            await pluginStoreApi.enablePlugin(name);
            toast.success('플러그인이 활성화되었습니다.');
            await loadPlugins();
        } catch (e: unknown) {
            toast.error('활성화 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        } finally {
            actionLoading[name] = false;
        }
    }

    async function disable(name: string) {
        actionLoading[name] = true;
        try {
            await pluginStoreApi.disablePlugin(name);
            toast.success('플러그인이 비활성화되었습니다.');
            await loadPlugins();
        } catch (e: unknown) {
            toast.error('비활성화 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        } finally {
            actionLoading[name] = false;
        }
    }

    async function uninstall(name: string) {
        actionLoading[name] = true;
        try {
            await pluginStoreApi.uninstallPlugin(name);
            toast.success('플러그인이 제거되었습니다.');
            await loadPlugins();
        } catch (e: unknown) {
            toast.error('제거 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        } finally {
            actionLoading[name] = false;
        }
    }

    async function openSettings(plugin: CatalogPlugin) {
        selectedPlugin = plugin;
        try {
            const data = await pluginStoreApi.getSettings(plugin.name);
            settingsSchema = data;
            settingValues = {};
            data.forEach((s) => {
                settingValues[s.key] = s.value ?? s.default_value;
            });
            showSettings = true;
        } catch (e: unknown) {
            toast.error('설정 조회 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        }
    }

    async function saveSettings() {
        if (!selectedPlugin) return;
        try {
            await pluginStoreApi.saveSettings(selectedPlugin.name, settingValues);
            showSettings = false;
            toast.success('설정이 저장되었습니다.');
        } catch (e: unknown) {
            toast.error('설정 저장 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        }
    }

    async function openEvents(plugin: CatalogPlugin) {
        selectedPlugin = plugin;
        try {
            events = await pluginStoreApi.getEvents(plugin.name);
            showEvents = true;
        } catch (e: unknown) {
            toast.error('이벤트 조회 실패: ' + ((e as Error).message || '알 수 없는 오류'));
        }
    }

    function getStatusVariant(plugin: CatalogPlugin) {
        if (!plugin.is_installed) return 'secondary' as const;
        if (plugin.status === 'enabled') return 'default' as const;
        if (plugin.status === 'disabled') return 'outline' as const;
        if (plugin.status === 'error') return 'destructive' as const;
        return 'secondary' as const;
    }

    function getStatusLabel(plugin: CatalogPlugin) {
        if (!plugin.is_installed) return '미설치';
        if (plugin.status === 'enabled') return '활성';
        if (plugin.status === 'disabled') return '비활성';
        if (plugin.status === 'error') return '오류';
        return '미설치';
    }

    function getEventLabel(type: string) {
        const labels: Record<string, string> = {
            installed: '설치',
            enabled: '활성화',
            disabled: '비활성화',
            uninstalled: '제거',
            config_changed: '설정 변경',
            error: '오류'
        };
        return labels[type] || type;
    }

    function getEventVariant(type: string) {
        if (type === 'enabled' || type === 'installed') return 'default' as const;
        if (type === 'disabled' || type === 'uninstalled') return 'secondary' as const;
        if (type === 'error') return 'destructive' as const;
        return 'outline' as const;
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
    }

    // 통계
    const stats = $derived({
        total: plugins.length,
        installed: plugins.filter((p) => p.is_installed).length,
        enabled: plugins.filter((p) => p.status === 'enabled').length
    });
</script>

<!-- 통계 -->
<div class="mb-6 flex items-center justify-between">
    <div class="text-muted-foreground text-sm">
        전체: {stats.total} · 설치: {stats.installed} · 활성: {stats.enabled}
    </div>
    <Button variant="outline" size="sm" onclick={loadPlugins}>
        <RefreshCw class="mr-2 h-4 w-4" />
        새로고침
    </Button>
</div>

<!-- 플러그인 목록 -->
{#if loading}
    <Card>
        <CardContent class="py-12 text-center">
            <p class="text-muted-foreground">로딩 중...</p>
        </CardContent>
    </Card>
{:else if plugins.length === 0}
    <Card>
        <CardContent class="py-12 text-center">
            <div class="mb-4 text-6xl">📦</div>
            <h2 class="mb-2 text-xl font-semibold">등록된 백엔드 플러그인이 없습니다</h2>
            <p class="text-muted-foreground">API 서버가 실행 중인지 확인하세요.</p>
        </CardContent>
    </Card>
{:else}
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each plugins as plugin (plugin.name)}
            <Card class="overflow-hidden">
                <!-- 아이콘 영역 -->
                <div class="bg-muted flex aspect-[3/1] items-center justify-center">
                    {#if plugin.status === 'enabled'}
                        <Power class="text-primary h-10 w-10" />
                    {:else}
                        <PowerOff class="text-muted-foreground h-10 w-10" />
                    {/if}
                </div>

                <CardHeader>
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="mb-1 flex items-center gap-2">
                                <CardTitle class="text-lg">{plugin.title || plugin.name}</CardTitle>
                            </div>
                            <CardDescription>
                                v{plugin.version}
                                {#if plugin.author}· {plugin.author}{/if}
                            </CardDescription>
                        </div>
                        <Badge variant={getStatusVariant(plugin)}>
                            {getStatusLabel(plugin)}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent>
                    <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                        {plugin.description || '설명 없음'}
                    </p>

                    <!-- 의존성/라이선스 -->
                    <div class="text-muted-foreground mb-4 flex flex-wrap gap-3 text-xs">
                        {#if plugin.license}
                            <span>{plugin.license}</span>
                        {/if}
                        {#if plugin.dependencies && plugin.dependencies.length > 0}
                            <span>의존: {plugin.dependencies.join(', ')}</span>
                        {/if}
                    </div>

                    <!-- 태그 -->
                    {#if plugin.tags && plugin.tags.length > 0}
                        <div class="mb-4 flex flex-wrap gap-1">
                            {#each plugin.tags as tag (tag)}
                                <Badge variant="outline" class="text-xs">{tag}</Badge>
                            {/each}
                        </div>
                    {/if}

                    <!-- 액션 버튼 -->
                    <div class="flex flex-wrap gap-2">
                        {#if !plugin.is_installed}
                            <Button
                                size="sm"
                                class="flex-1"
                                disabled={actionLoading[plugin.name]}
                                onclick={() => install(plugin.name)}
                            >
                                <Download class="mr-1 h-3 w-3" />
                                {actionLoading[plugin.name] ? '처리 중...' : '설치'}
                            </Button>
                        {:else if plugin.status === 'enabled'}
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                disabled={actionLoading[plugin.name]}
                                onclick={() => disable(plugin.name)}
                            >
                                {actionLoading[plugin.name] ? '처리 중...' : '비활성화'}
                            </Button>
                            {#if plugin.settings && plugin.settings.length > 0}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => openSettings(plugin)}
                                >
                                    <Settings class="h-3 w-3" />
                                </Button>
                            {/if}
                        {:else if plugin.status === 'disabled'}
                            <Button
                                size="sm"
                                class="flex-1"
                                disabled={actionLoading[plugin.name]}
                                onclick={() => enable(plugin.name)}
                            >
                                {actionLoading[plugin.name] ? '처리 중...' : '활성화'}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={actionLoading[plugin.name]}
                                onclick={() => uninstall(plugin.name)}
                            >
                                <Trash2 class="h-3 w-3" />
                            </Button>
                        {:else if plugin.status === 'error'}
                            <Button
                                size="sm"
                                class="flex-1"
                                disabled={actionLoading[plugin.name]}
                                onclick={() => enable(plugin.name)}
                            >
                                재시도
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={actionLoading[plugin.name]}
                                onclick={() => uninstall(plugin.name)}
                            >
                                <Trash2 class="h-3 w-3" />
                            </Button>
                        {/if}
                        {#if plugin.is_installed}
                            <Button variant="ghost" size="sm" onclick={() => openEvents(plugin)}>
                                <History class="h-3 w-3" />
                            </Button>
                        {/if}
                    </div>
                </CardContent>
            </Card>
        {/each}
    </div>
{/if}

<!-- 설정 모달 -->
<Dialog bind:open={showSettings}>
    <DialogContent class="max-w-lg">
        <DialogHeader>
            <DialogTitle>{selectedPlugin?.title || selectedPlugin?.name} 설정</DialogTitle>
            <DialogDescription>플러그인 설정을 변경합니다.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
            {#each settingsSchema as setting (setting.key)}
                <div class="space-y-2">
                    <Label for={setting.key}>{setting.label || setting.key}</Label>
                    {#if setting.type === 'boolean'}
                        <div class="flex items-center gap-2">
                            <Switch
                                id={setting.key}
                                checked={settingValues[setting.key] as boolean}
                                onCheckedChange={(v: boolean) => (settingValues[setting.key] = v)}
                            />
                            <span class="text-muted-foreground text-sm">
                                {settingValues[setting.key] ? '활성' : '비활성'}
                            </span>
                        </div>
                    {:else if setting.type === 'number'}
                        <Input
                            id={setting.key}
                            type="number"
                            value={settingValues[setting.key] as string}
                            oninput={(e: Event) =>
                                (settingValues[setting.key] = Number(
                                    (e.target as HTMLInputElement).value
                                ))}
                        />
                    {:else}
                        <Input
                            id={setting.key}
                            type="text"
                            value={settingValues[setting.key] as string}
                            oninput={(e: Event) =>
                                (settingValues[setting.key] = (e.target as HTMLInputElement).value)}
                        />
                    {/if}
                </div>
            {/each}
        </div>
        <div class="flex justify-end gap-2">
            <Button variant="outline" onclick={() => (showSettings = false)}>취소</Button>
            <Button onclick={saveSettings}>저장</Button>
        </div>
    </DialogContent>
</Dialog>

<!-- 이벤트 로그 모달 -->
<Dialog bind:open={showEvents}>
    <DialogContent class="max-w-2xl">
        <DialogHeader>
            <DialogTitle>{selectedPlugin?.title || selectedPlugin?.name} 이벤트 로그</DialogTitle>
            <DialogDescription>플러그인의 설치/활성화/비활성화 이력입니다.</DialogDescription>
        </DialogHeader>
        <div class="max-h-[400px] overflow-y-auto py-4">
            {#if events.length === 0}
                <p class="text-muted-foreground text-center">이벤트 기록이 없습니다.</p>
            {:else}
                <div class="space-y-3">
                    {#each events as event (event.id)}
                        <div class="flex items-center gap-3 rounded-lg border p-3">
                            <Badge variant={getEventVariant(event.event_type)}>
                                {getEventLabel(event.event_type)}
                            </Badge>
                            <div class="flex-1">
                                <span class="text-muted-foreground text-xs">
                                    {formatDate(event.created_at)}
                                </span>
                                {#if event.actor_id}
                                    <span class="text-muted-foreground text-xs">
                                        · {event.actor_id}</span
                                    >
                                {/if}
                            </div>
                            {#if event.details}
                                <code class="text-muted-foreground text-xs">
                                    {JSON.stringify(event.details)}
                                </code>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="flex justify-end">
            <Button variant="outline" onclick={() => (showEvents = false)}>닫기</Button>
        </div>
    </DialogContent>
</Dialog>
