<script lang="ts">
    import { onMount } from 'svelte';
    import { themeStore } from '$lib/stores/theme-store.svelte';
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
    import ThemeUploader from '$lib/components/theme-uploader.svelte';
    import { Trash2 } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';
    import { t } from '$lib/i18n';

    // Store에서 테마 목록 가져오기
    const themes = $derived(themeStore.themes);

    // 페이지 로드 시 Web API에서 테마 목록 가져오기
    onMount(() => {
        themeStore.loadThemes();
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

    // 테마 삭제
    async function deleteTheme(themeId: string, themeName: string) {
        if (!confirm(t('admin_themes_deleteConfirm'))) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5173/api/themes/${themeId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success(t('admin_themes_uploadSuccess'));
                themeStore.loadThemes();
            } else {
                toast.error(result.error || t('admin_themes_uploadError'));
            }
        } catch (error) {
            toast.error(t('admin_themes_uploadError'));
            console.error('Theme deletion error:', error);
        }
    }

    // 업로드 성공 콜백
    function handleUploadSuccess() {
        themeStore.loadThemes(); // 테마 목록 새로고침
    }
</script>

<Toaster />

<div class="container mx-auto p-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold">{t('admin_themes_title')}</h1>
        <p class="text-muted-foreground mt-2">{t('admin_themes_noThemes')}</p>
    </div>

    <!-- 상단 액션 바 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex gap-2">
            <ThemeUploader onUploadSuccess={handleUploadSuccess} />
            <Button variant="outline">{t('admin_themes_marketplace')}</Button>
        </div>
        <div class="text-muted-foreground text-sm">{t('admin_themes_installed')}: {themes.length}</div>
    </div>

    <!-- 테마 목록 -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each themes as theme (theme.manifest.id)}
            <Card class="overflow-hidden">
                <!-- 스크린샷 영역 -->
                {#if theme.manifest.screenshot}
                    <div class="bg-muted aspect-video">
                        <img
                            src={theme.manifest.screenshot}
                            alt={theme.manifest.name}
                            class="h-full w-full object-cover"
                        />
                    </div>
                {:else}
                    <div class="bg-muted flex aspect-video items-center justify-center">
                        <span class="text-muted-foreground text-sm">{t('common_preview')}</span>
                    </div>
                {/if}

                <CardHeader>
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="mb-2 flex items-center gap-2">
                                <CardTitle>{theme.manifest.name}</CardTitle>
                                <!-- 출처 배지 -->
                                {#if theme.source === 'official'}
                                    <Badge variant="default" class="text-xs">{t('admin_themes_official')}</Badge>
                                {:else if theme.source === 'custom'}
                                    <Badge variant="secondary" class="text-xs">{t('admin_themes_custom')}</Badge>
                                {/if}
                            </div>
                            <CardDescription class="mt-1">
                                v{theme.manifest.version} · {theme.manifest.author.name}
                            </CardDescription>
                        </div>
                        <Badge variant={getStatusVariant(theme.status)}>
                            {getStatusLabel(theme.status)}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent>
                    <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                        {theme.manifest.description}
                    </p>

                    <!-- 태그 -->
                    {#if theme.manifest.tags && theme.manifest.tags.length > 0}
                        <div class="mb-4 flex flex-wrap gap-1">
                            {#each theme.manifest.tags.slice(0, 3) as tag (tag)}
                                <Badge variant="outline" class="text-xs">{tag}</Badge>
                            {/each}
                        </div>
                    {/if}

                    <!-- 통계 -->
                    <div class="text-muted-foreground mb-4 flex gap-4 text-xs">
                        {#if theme.downloadCount}
                            <span>{t('common_download')}: {theme.downloadCount.toLocaleString()}</span>
                        {/if}
                        {#if theme.manifest.components}
                            <span>Components: {theme.manifest.components.length}</span>
                        {/if}
                        {#if theme.manifest.hooks}
                            <span>Hooks: {theme.manifest.hooks.length}</span>
                        {/if}
                    </div>

                    <!-- 액션 버튼 -->
                    <div class="flex gap-2">
                        {#if theme.status === 'active'}
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                href={`/themes/${theme.manifest.id}/settings`}
                            >
                                {t('common_settings')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                disabled={themeStore.isThemeLoading(theme.manifest.id)}
                                onclick={() => themeStore.deactivateTheme(theme.manifest.id)}
                            >
                                {themeStore.isActionInProgress(theme.manifest.id, 'deactivate')
                                    ? t('common_loading')
                                    : t('common_deactivate')}
                            </Button>
                        {:else if theme.status === 'inactive'}
                            <Button
                                size="sm"
                                class="flex-1"
                                disabled={themeStore.isThemeLoading(theme.manifest.id)}
                                onclick={() => themeStore.activateTheme(theme.manifest.id)}
                            >
                                {themeStore.isActionInProgress(theme.manifest.id, 'activate')
                                    ? t('common_loading')
                                    : t('common_activate')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                href={`/themes/${theme.manifest.id}/settings`}
                            >
                                {t('common_settings')}
                            </Button>
                            <!-- 커스텀 테마만 삭제 버튼 표시 -->
                            {#if theme.source === 'custom'}
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    class="flex-shrink-0"
                                    onclick={() =>
                                        deleteTheme(theme.manifest.id, theme.manifest.name)}
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            {/if}
                        {:else if theme.status === 'installing'}
                            <Button disabled size="sm" class="flex-1">{t('common_loading')}</Button>
                        {:else if theme.status === 'error'}
                            <Button
                                variant="destructive"
                                size="sm"
                                class="flex-1"
                                disabled={themeStore.isThemeLoading(theme.manifest.id)}
                                onclick={() => themeStore.retryInstall(theme.manifest.id)}
                            >
                                {themeStore.isActionInProgress(theme.manifest.id, 'install')
                                    ? t('common_loading')
                                    : t('common_refresh')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                disabled={themeStore.isThemeLoading(theme.manifest.id)}
                                onclick={() => themeStore.deleteTheme(theme.manifest.id)}
                            >
                                {themeStore.isActionInProgress(theme.manifest.id, 'delete')
                                    ? t('common_loading')
                                    : t('common_delete')}
                            </Button>
                        {/if}
                    </div>

                    <!-- 에러 메시지 -->
                    {#if theme.status === 'error' && theme.errorMessage}
                        <div class="bg-destructive/10 text-destructive mt-3 rounded-md p-2 text-xs">
                            {theme.errorMessage}
                        </div>
                    {/if}
                </CardContent>
            </Card>
        {/each}
    </div>
</div>
