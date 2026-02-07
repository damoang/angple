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
    import PluginSettingsForm from '$lib/components/plugin/plugin-settings-form.svelte';
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
                <CardContent>
                    <!-- eslint-disable @typescript-eslint/no-explicit-any -->
                    <PluginSettingsForm
                        schema={plugin.manifest.settings as any}
                        bind:values={settings}
                    />
                    <!-- eslint-enable @typescript-eslint/no-explicit-any -->
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
