<script lang="ts">
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import { API_KEY_SERVICE_META, type ApiKeyServiceMeta } from '$lib/types/admin-settings.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Save from '@lucide/svelte/icons/save';
    import Eye from '@lucide/svelte/icons/eye';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    // 비밀번호 필드 표시 상태
    let visibleFields = $state<Record<string, boolean>>({});

    function toggleVisibility(fieldKey: string) {
        visibleFields[fieldKey] = !visibleFields[fieldKey];
    }

    function getFieldValue(serviceId: string, fieldKey: string): string {
        const service = adminSettingsStore.settings.apiKeys?.[serviceId as keyof typeof adminSettingsStore.settings.apiKeys];
        if (!service) return '';
        return String((service as Record<string, unknown>)[fieldKey] ?? '');
    }

    function setFieldValue(serviceId: string, fieldKey: string, value: string) {
        if (!adminSettingsStore.settings.apiKeys) return;
        const service = adminSettingsStore.settings.apiKeys[serviceId as keyof typeof adminSettingsStore.settings.apiKeys];
        if (!service) return;
        (service as Record<string, unknown>)[fieldKey] = fieldKey === 'port' ? Number(value) || 0 : value;
    }

    function isEnabled(serviceId: string): boolean {
        return adminSettingsStore.settings.apiKeys?.[serviceId as keyof typeof adminSettingsStore.settings.apiKeys]?.enabled ?? false;
    }

    function toggleEnabled(serviceId: string) {
        if (!adminSettingsStore.settings.apiKeys) return;
        const service = adminSettingsStore.settings.apiKeys[serviceId as keyof typeof adminSettingsStore.settings.apiKeys];
        if (service) service.enabled = !service.enabled;
    }
</script>

<div class="space-y-8">
    {#each API_KEY_SERVICE_META as service (service.id)}
        <div class="rounded-lg border p-4">
            <div class="mb-4 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-semibold">{service.name}</h3>
                    <p class="text-muted-foreground text-xs">{service.description}</p>
                </div>
                <div class="flex items-center gap-3">
                    {#if service.consoleUrl}
                        <a
                            href={service.consoleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                        >
                            콘솔 <ExternalLink class="h-3 w-3" />
                        </a>
                    {/if}
                    <Switch
                        checked={isEnabled(service.id)}
                        onCheckedChange={() => toggleEnabled(service.id)}
                    />
                </div>
            </div>

            {#if isEnabled(service.id)}
                <div class="space-y-3">
                    {#each service.fields as field (field.key)}
                        {@const uniqueKey = `${service.id}-${field.key}`}
                        {@const isPassword = field.type === 'password'}
                        <div class="space-y-1">
                            <Label for={uniqueKey}>{field.label}</Label>
                            <div class="relative">
                                <Input
                                    id={uniqueKey}
                                    type={isPassword && !visibleFields[uniqueKey] ? 'password' : field.type === 'number' ? 'number' : 'text'}
                                    placeholder={field.placeholder}
                                    value={getFieldValue(service.id, field.key)}
                                    oninput={(e: Event) => setFieldValue(service.id, field.key, (e.target as HTMLInputElement).value)}
                                    class={isPassword ? 'pr-10' : ''}
                                />
                                {#if isPassword}
                                    <button
                                        type="button"
                                        onclick={() => toggleVisibility(uniqueKey)}
                                        class="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                                    >
                                        {#if visibleFields[uniqueKey]}
                                            <EyeOff class="h-4 w-4" />
                                        {:else}
                                            <Eye class="h-4 w-4" />
                                        {/if}
                                    </button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}

    <div class="flex justify-end">
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
