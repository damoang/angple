<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { adminThemeStore } from '$lib/stores/admin-theme-store.svelte';
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
    import { ChevronLeft, Save, Monitor, Tablet, Smartphone } from '@lucide/svelte/icons';
    import * as adminThemesApi from '$lib/api/admin-themes';

    /**
     * 테마 설정 페이지
     *
     * 테마별 설정 스키마를 렌더링하고 설정값을 저장합니다.
     * 반응형 뷰 전환 (데스크탑/태블릿/모바일) 포함
     */

    const themeId = $derived($page.params.id || '');
    const theme = $derived(adminThemeStore.getThemeById(themeId));

    // 설정값 상태 (현재 설정값으로 초기화)
    let settings = $state<Record<string, Record<string, unknown>>>({});
    let isLoading = $state(false);
    let previewIframe: HTMLIFrameElement;

    // 미리보기 디바이스 모드
    type DeviceMode = 'desktop' | 'tablet' | 'mobile';
    let deviceMode = $state<DeviceMode>('desktop');

    // 디바이스별 너비
    const deviceWidths = {
        desktop: '100%',
        tablet: '768px',
        mobile: '375px'
    };

    // 테마가 없으면 목록으로 이동
    onMount(() => {
        if (!theme) {
            toast.error('테마를 찾을 수 없습니다.');
            goto('/admin/themes');
            return;
        }

        // 현재 설정값으로 초기화 (카테고리 객체 생성)
        settings = {};
        if (theme.currentSettings) {
            settings = JSON.parse(JSON.stringify(theme.currentSettings));
        }

        // 카테고리가 없으면 생성
        if (theme.manifest.settings) {
            for (const category of Object.keys(theme.manifest.settings)) {
                if (!settings[category]) {
                    settings[category] = {};
                }
            }
        }
    });

    /**
     * 설정값 저장
     */
    async function saveSettings() {
        if (!theme) return;

        isLoading = true;
        try {
            // API 호출로 설정 저장
            await adminThemesApi.setThemeSettings(themeId, settings);

            // 로컬 상태도 업데이트
            theme.currentSettings = JSON.parse(JSON.stringify(settings));

            // iframe URL 파라미터로 새로고침 (즉시 반영!)
            if (previewIframe) {
                previewIframe.src = `/?reload=${Date.now()}`;
            }

            toast.success('설정이 저장되었습니다. 미리보기가 업데이트됩니다.');
        } catch (error) {
            console.error('설정 저장 실패:', error);
            toast.error('설정 저장에 실패했습니다.');
        } finally {
            isLoading = false;
        }
    }

    /**
     * 기본값으로 초기화
     */
    function resetToDefaults() {
        if (!theme?.manifest.settings) return;

        settings = {};

        for (const [category, fields] of Object.entries(theme.manifest.settings)) {
            settings[category] = {};
            for (const [key, field] of Object.entries(fields)) {
                settings[category][key] = field.default;
            }
        }

        toast.info('기본값으로 초기화되었습니다.');
    }
</script>

<div class="container mx-auto max-w-7xl py-8">
    <!-- 헤더 -->
    <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" href="/admin/themes">
                <ChevronLeft class="h-5 w-5" />
            </Button>
            <div>
                <h1 class="text-3xl font-bold">{theme?.manifest.name || '테마'} 설정</h1>
                <p class="text-muted-foreground">
                    테마의 모양과 동작을 사용자 정의하세요. 아래에서 실시간 미리보기를 확인하세요.
                </p>
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

    <!-- 세로 레이아웃: 위에 설정 폼, 아래 미리보기 -->
    <div class="space-y-8">
        <!-- 설정 폼 -->
        <div class="space-y-6">
            {#if theme?.manifest.settings}
                {#each Object.entries(theme.manifest.settings) as [category, fields] (category)}
                    <Card>
                        <CardHeader>
                            <CardTitle class="capitalize">{category}</CardTitle>
                            <CardDescription>
                                {category === 'appearance' ? '테마의 외관을 설정합니다.' : ''}
                                {category === 'layout' ? '레이아웃 옵션을 설정합니다.' : ''}
                                {category === 'features' ? '기능을 활성화/비활성화합니다.' : ''}
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-6">
                            {#each Object.entries(fields) as [key, field] (`${category}-${key}`)}
                                {#if settings[category]}
                                    <div class="space-y-2">
                                        <!-- 텍스트 입력 -->
                                        {#if field.type === 'text'}
                                            <Label for={`${category}-${key}`}>{field.label}</Label>
                                            <Input
                                                id={`${category}-${key}`}
                                                type="text"
                                                bind:value={settings[category][key]}
                                                placeholder={field.default}
                                            />
                                        {/if}

                                        <!-- 색상 선택 -->
                                        {#if field.type === 'color'}
                                            <Label for={`${category}-${key}`}>{field.label}</Label>
                                            <div class="flex items-center gap-4">
                                                <Input
                                                    id={`${category}-${key}`}
                                                    type="color"
                                                    bind:value={settings[category][key]}
                                                    class="h-12 w-24"
                                                />
                                                <Input
                                                    type="text"
                                                    bind:value={settings[category][key]}
                                                    placeholder={field.default}
                                                    class="flex-1"
                                                />
                                            </div>
                                        {/if}

                                        <!-- 토글 스위치 -->
                                        {#if field.type === 'boolean'}
                                            <div class="flex items-center justify-between">
                                                <Label
                                                    for={`${category}-${key}`}
                                                    class="flex flex-col gap-1"
                                                >
                                                    <span>{field.label}</span>
                                                    {#if field.description}
                                                        <span
                                                            class="text-muted-foreground text-sm font-normal"
                                                        >
                                                            {field.description}
                                                        </span>
                                                    {/if}
                                                </Label>
                                                <Switch
                                                    id={`${category}-${key}`}
                                                    bind:checked={settings[category][
                                                        key
                                                    ] as boolean}
                                                />
                                            </div>
                                        {/if}

                                        <!-- 숫자 입력 -->
                                        {#if field.type === 'number'}
                                            <Label for={`${category}-${key}`}>{field.label}</Label>
                                            <Input
                                                id={`${category}-${key}`}
                                                type="number"
                                                bind:value={settings[category][key]}
                                                min={typeof field === 'object' &&
                                                field &&
                                                'min' in field
                                                    ? (field.min as number)
                                                    : undefined}
                                                max={typeof field === 'object' &&
                                                field &&
                                                'max' in field
                                                    ? (field.max as number)
                                                    : undefined}
                                                step={typeof field === 'object' &&
                                                field &&
                                                'step' in field
                                                    ? (field.step as number)
                                                    : 1}
                                            />
                                        {/if}
                                    </div>
                                {/if}
                            {/each}
                        </CardContent>
                    </Card>
                {/each}
            {:else}
                <!-- 설정 없음 -->
                <Card>
                    <CardContent class="py-12 text-center">
                        <p class="text-muted-foreground">이 테마는 설정 가능한 옵션이 없습니다.</p>
                    </CardContent>
                </Card>
            {/if}
        </div>

        <!-- 미리보기 iframe -->
        <div class="space-y-4">
            <Card>
                <CardHeader>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <Monitor class="h-5 w-5" />
                            <CardTitle>실시간 미리보기</CardTitle>
                        </div>
                        <!-- 반응형 뷰 전환 버튼 -->
                        <div class="flex gap-1 rounded-lg border p-1">
                            <Button
                                variant={deviceMode === 'desktop' ? 'default' : 'ghost'}
                                size="sm"
                                class="h-8 w-8 p-0"
                                onclick={() => (deviceMode = 'desktop')}
                            >
                                <Monitor class="h-4 w-4" />
                            </Button>
                            <Button
                                variant={deviceMode === 'tablet' ? 'default' : 'ghost'}
                                size="sm"
                                class="h-8 w-8 p-0"
                                onclick={() => (deviceMode = 'tablet')}
                            >
                                <Tablet class="h-4 w-4" />
                            </Button>
                            <Button
                                variant={deviceMode === 'mobile' ? 'default' : 'ghost'}
                                size="sm"
                                class="h-8 w-8 p-0"
                                onclick={() => (deviceMode = 'mobile')}
                            >
                                <Smartphone class="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <CardDescription>
                        설정을 저장하면 즉시 반영됩니다. 디바이스 버튼으로 반응형 미리보기를
                        전환하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div
                        class="bg-muted flex min-h-[600px] items-center justify-center overflow-hidden rounded-lg p-4"
                    >
                        <div
                            class="border-border h-full overflow-hidden rounded-lg border bg-white shadow-lg transition-all duration-300"
                            style={`width: ${deviceWidths[deviceMode]}; max-width: 100%;`}
                        >
                            <iframe
                                bind:this={previewIframe}
                                src="/"
                                title="테마 미리보기"
                                class="h-full w-full"
                                style="min-height: 600px;"
                                sandbox="allow-scripts allow-same-origin"
                            ></iframe>
                        </div>
                    </div>
                    <p class="text-muted-foreground mt-4 text-center text-sm">
                        설정 변경 후 "저장" 버튼을 클릭하면 미리보기가 자동으로 업데이트됩니다.
                    </p>
                </CardContent>
            </Card>
        </div>
    </div>
</div>
