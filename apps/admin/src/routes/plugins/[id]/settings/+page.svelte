<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin-store.svelte';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import { toast } from 'svelte-sonner';
    import { Toaster } from '$lib/components/ui/sonner';
    import { ChevronLeft, Save } from '@lucide/svelte/icons';
    import * as pluginsApi from '$lib/api/plugins';

    /**
     * 플러그인 설정 페이지
     *
     * 플러그인별 설정 스키마를 렌더링하고 설정값을 저장합니다.
     */

    const pluginId = $derived($page.params.id || '');
    const plugin = $derived(pluginStore.getPluginById(pluginId));

    // 설정값 상태 (현재 설정값으로 초기화)
    let settings = $state<Record<string, unknown>>({});
    let isLoading = $state(false);

    // 플러그인이 없으면 목록으로 이동
    onMount(() => {
        // 플러그인 목록이 비어있으면 먼저 로드
        if (pluginStore.plugins.length === 0) {
            pluginStore.loadPlugins();
        }
    });

    // 플러그인이 로드되면 설정 초기화
    $effect(() => {
        if (plugin) {
            settings = JSON.parse(JSON.stringify(plugin.currentSettings || {}));
        }
    });

    /**
     * 설정값 저장
     */
    async function saveSettings() {
        if (!plugin) return;

        isLoading = true;
        try {
            // Web API 호출로 설정 저장
            await pluginsApi.setPluginSettings(pluginId, settings);

            // 로컬 상태도 업데이트
            plugin.currentSettings = JSON.parse(JSON.stringify(settings));

            toast.success('설정이 저장되었습니다.');
        } catch (error) {
            console.error('설정 저장 실패:', error);
            toast.error('설정 저장에 실패했습니다. Web 앱이 실행 중인지 확인하세요.');
        } finally {
            isLoading = false;
        }
    }

    /**
     * 기본값으로 초기화
     */
    function resetToDefaults() {
        if (!plugin?.manifest.settings) return;

        settings = {};

        for (const [key, field] of Object.entries(plugin.manifest.settings)) {
            settings[key] = field.default;
        }

        toast.info('기본값으로 초기화되었습니다.');
    }
</script>

<Toaster />

<div class="container mx-auto max-w-4xl py-8">
    <!-- 헤더 -->
    <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" href="/plugins">
                <ChevronLeft class="h-5 w-5" />
            </Button>
            <div>
                <h1 class="text-3xl font-bold">{plugin?.manifest.name || '플러그인'} 설정</h1>
                <p class="text-muted-foreground">플러그인의 동작을 사용자 정의하세요.</p>
            </div>
        </div>
        <div class="flex gap-2">
            <Button variant="outline" onclick={resetToDefaults}>기본값 복원</Button>
            <Button onclick={saveSettings} disabled={isLoading}>
                <Save class="mr-2 h-4 w-4" />
                {isLoading ? '저장 중...' : '저장'}
            </Button>
        </div>
    </div>

    <!-- 설정 폼 -->
    <div class="space-y-6">
        {#if plugin?.manifest.settings && Object.keys(plugin.manifest.settings).length > 0}
            <Card>
                <CardHeader>
                    <CardTitle>플러그인 설정</CardTitle>
                    <CardDescription>
                        {plugin.manifest.description || '플러그인 설정을 구성합니다.'}
                    </CardDescription>
                </CardHeader>
                <CardContent class="space-y-6">
                    {#each Object.entries(plugin.manifest.settings) as [key, field] (key)}
                        <div class="space-y-2">
                            <!-- 텍스트/URL 입력 -->
                            {#if field.type === 'text' || field.type === 'url'}
                                <Label for={key}>{field.label}</Label>
                                {#if field.description}
                                    <p class="text-muted-foreground text-sm">{field.description}</p>
                                {/if}
                                <Input
                                    id={key}
                                    type={field.type === 'url' ? 'url' : 'text'}
                                    bind:value={settings[key]}
                                    placeholder={field.default as string}
                                />
                            {/if}

                            <!-- 색상 선택 -->
                            {#if field.type === 'color'}
                                <Label for={key}>{field.label}</Label>
                                {#if field.description}
                                    <p class="text-muted-foreground text-sm">{field.description}</p>
                                {/if}
                                <div class="flex items-center gap-4">
                                    <Input
                                        id={key}
                                        type="color"
                                        bind:value={settings[key]}
                                        class="h-12 w-24"
                                    />
                                    <Input
                                        type="text"
                                        bind:value={settings[key]}
                                        placeholder={field.default as string}
                                        class="flex-1"
                                    />
                                </div>
                            {/if}

                            <!-- 토글 스위치 -->
                            {#if field.type === 'boolean'}
                                <div
                                    class="flex items-center justify-between rounded-lg border p-4"
                                >
                                    <Label for={key} class="flex flex-col gap-1">
                                        <span>{field.label}</span>
                                        {#if field.description}
                                            <span class="text-muted-foreground text-sm font-normal">
                                                {field.description}
                                            </span>
                                        {/if}
                                    </Label>
                                    <Switch
                                        id={key}
                                        checked={(settings[key] as boolean) ?? field.default}
                                        onCheckedChange={(checked: boolean) =>
                                            (settings[key] = checked)}
                                    />
                                </div>
                            {/if}

                            <!-- 숫자 입력 -->
                            {#if field.type === 'number'}
                                <Label for={key}>{field.label}</Label>
                                {#if field.description}
                                    <p class="text-muted-foreground text-sm">{field.description}</p>
                                {/if}
                                <Input
                                    id={key}
                                    type="number"
                                    bind:value={settings[key]}
                                    min={field.min}
                                    max={field.max}
                                    step={field.step ?? 1}
                                />
                            {/if}

                            <!-- 텍스트 영역 -->
                            {#if field.type === 'textarea'}
                                <Label for={key}>{field.label}</Label>
                                {#if field.description}
                                    <p class="text-muted-foreground text-sm">{field.description}</p>
                                {/if}
                                <textarea
                                    id={key}
                                    bind:value={settings[key]}
                                    placeholder={field.default as string}
                                    rows="4"
                                    class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                ></textarea>
                            {/if}
                        </div>
                    {/each}
                </CardContent>
            </Card>
        {:else}
            <!-- 설정 없음 -->
            <Card>
                <CardContent class="py-12 text-center">
                    <p class="text-muted-foreground">이 플러그인은 설정 가능한 옵션이 없습니다.</p>
                </CardContent>
            </Card>
        {/if}
    </div>
</div>
