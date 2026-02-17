<script lang="ts">
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import { FEATURE_FLAG_META } from '$lib/types/admin-settings.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Save from '@lucide/svelte/icons/save';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Info from '@lucide/svelte/icons/info';
</script>

<div class="space-y-6">
    <div class="space-y-4">
        {#each FEATURE_FLAG_META as flag}
            <div class="flex items-start justify-between rounded-lg border p-4">
                <div class="space-y-1">
                    <div class="font-medium">{flag.name}</div>
                    <div class="text-muted-foreground text-sm">{flag.description}</div>
                    {#if flag.dependency}
                        <div class="text-muted-foreground flex items-center gap-1 text-xs">
                            <Info class="h-3 w-3" />
                            필요: {flag.dependency}
                        </div>
                    {/if}
                </div>
                <Switch
                    checked={adminSettingsStore.settings.featureFlags[flag.id]}
                    onCheckedChange={(checked) => {
                        adminSettingsStore.settings.featureFlags[flag.id] = checked;
                    }}
                />
            </div>
        {/each}
    </div>

    <Button
        onclick={() => adminSettingsStore.saveSettings()}
        disabled={adminSettingsStore.isSaving}
    >
        {#if adminSettingsStore.isSaving}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            저장 중...
        {:else}
            <Save class="mr-2 h-4 w-4" />
            저장
        {/if}
    </Button>
</div>
