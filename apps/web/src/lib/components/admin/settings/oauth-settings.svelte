<script lang="ts">
    import { page } from '$app/stores';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import { OAUTH_PROVIDER_META } from '$lib/types/admin-settings.js';
    import type { OAuthProvider } from '$lib/api/types.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Save from '@lucide/svelte/icons/save';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import Copy from '@lucide/svelte/icons/copy';

    const origin = $derived($page.url.origin);

    function callbackUrl(provider: OAuthProvider): string {
        return `${origin}/auth/callback/${provider}`;
    }

    async function copyToClipboard(text: string): Promise<void> {
        await navigator.clipboard.writeText(text);
    }
</script>

<div class="space-y-4">
    {#each OAUTH_PROVIDER_META as meta}
        {@const config = adminSettingsStore.settings.oauth[meta.id]}
        <Card>
            <CardHeader class="pb-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div
                            class="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white"
                            style="background-color: {meta.color}"
                        >
                            {meta.name.charAt(0)}
                        </div>
                        <div>
                            <CardTitle class="text-base">{meta.name}</CardTitle>
                            <CardDescription class="text-xs">
                                <a
                                    href={meta.consoleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1 hover:underline"
                                >
                                    개발자 콘솔
                                    <ExternalLink class="h-3 w-3" />
                                </a>
                            </CardDescription>
                        </div>
                    </div>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={(v) => {
                            adminSettingsStore.settings.oauth[meta.id].enabled = v;
                        }}
                    />
                </div>
            </CardHeader>

            {#if config.enabled}
                <CardContent class="space-y-3 pt-0">
                    <!-- Callback URL (읽기전용) -->
                    <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground">Callback URL</Label>
                        <div class="flex gap-2">
                            <Input value={callbackUrl(meta.id)} readonly class="bg-muted text-xs" />
                            <Button
                                variant="outline"
                                size="icon"
                                class="shrink-0"
                                onclick={() => copyToClipboard(callbackUrl(meta.id))}
                            >
                                <Copy class="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <!-- 기본 필드 (clientId, clientSecret) -->
                    {#each meta.fields as field}
                        <div class="space-y-1">
                            <Label class="text-xs">{field.label}</Label>
                            <Input
                                type={field.key === 'clientSecret' ? 'password' : 'text'}
                                placeholder={field.placeholder}
                                value={config[field.key as keyof typeof config] as string ?? ''}
                                oninput={(e) => {
                                    (adminSettingsStore.settings.oauth[meta.id] as any)[field.key] = e.currentTarget.value;
                                }}
                            />
                        </div>
                    {/each}

                    <!-- 추가 필드 (Apple 등) -->
                    {#if meta.extraFields}
                        {#each meta.extraFields as field}
                            <div class="space-y-1">
                                <Label class="text-xs">{field.label}</Label>
                                <Input
                                    placeholder={field.placeholder}
                                    value={config.extra?.[field.key] ?? ''}
                                    oninput={(e) => {
                                        if (!adminSettingsStore.settings.oauth[meta.id].extra) {
                                            adminSettingsStore.settings.oauth[meta.id].extra = {};
                                        }
                                        adminSettingsStore.settings.oauth[meta.id].extra![field.key] = e.currentTarget.value;
                                    }}
                                />
                            </div>
                        {/each}
                    {/if}
                </CardContent>
            {/if}
        </Card>
    {/each}

    <div class="flex justify-end pt-2">
        <Button onclick={() => adminSettingsStore.saveSettings()} disabled={adminSettingsStore.isSaving}>
            {#if adminSettingsStore.isSaving}
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                저장 중...
            {:else}
                <Save class="mr-2 h-4 w-4" />
                저장
            {/if}
        </Button>
    </div>
</div>
