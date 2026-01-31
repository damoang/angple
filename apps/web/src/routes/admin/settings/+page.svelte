<script lang="ts">
    import { onMount } from 'svelte';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import GeneralSettings from '$lib/components/admin/settings/general-settings.svelte';
    import OauthSettings from '$lib/components/admin/settings/oauth-settings.svelte';
    import AnalyticsSettings from '$lib/components/admin/settings/analytics-settings.svelte';
    import ApiKeysSettings from '$lib/components/admin/settings/api-keys-settings.svelte';
    import Settings from '@lucide/svelte/icons/settings';
    import Shield from '@lucide/svelte/icons/shield';
    import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
    import KeyRound from '@lucide/svelte/icons/key-round';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    onMount(() => {
        adminSettingsStore.loadSettings();
    });
</script>

<svelte:head>
    <title>설정 - 관리자</title>
</svelte:head>

<div>
    <h1 class="text-foreground mb-2 text-3xl font-bold">설정</h1>
    <p class="text-muted-foreground mb-8">사이트 전반 설정을 관리합니다.</p>

    {#if adminSettingsStore.isLoading}
        <div class="flex items-center justify-center py-16">
            <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
    {:else}
        <Tabs value="general">
            <TabsList>
                <TabsTrigger value="general" class="gap-1.5">
                    <Settings class="h-4 w-4" />
                    일반
                </TabsTrigger>
                <TabsTrigger value="oauth" class="gap-1.5">
                    <Shield class="h-4 w-4" />
                    OAuth
                </TabsTrigger>
                <TabsTrigger value="analytics" class="gap-1.5">
                    <BarChart3 class="h-4 w-4" />
                    분석
                </TabsTrigger>
                <TabsTrigger value="api-keys" class="gap-1.5">
                    <KeyRound class="h-4 w-4" />
                    API 키
                </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
                <Card>
                    <CardHeader>
                        <CardTitle>일반 설정</CardTitle>
                        <CardDescription>사이트 기본 정보를 설정합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <GeneralSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="oauth">
                <Card>
                    <CardHeader>
                        <CardTitle>OAuth 프로바이더</CardTitle>
                        <CardDescription>소셜 로그인 프로바이더를 설정합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OauthSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="analytics">
                <Card>
                    <CardHeader>
                        <CardTitle>분석</CardTitle>
                        <CardDescription>사이트 분석 도구를 설정합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AnalyticsSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="api-keys">
                <Card>
                    <CardHeader>
                        <CardTitle>API 키</CardTitle>
                        <CardDescription>외부 서비스 API 키를 관리합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ApiKeysSettings />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    {/if}
</div>
