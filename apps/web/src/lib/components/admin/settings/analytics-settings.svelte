<script lang="ts">
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Save from '@lucide/svelte/icons/save';
</script>

<div class="space-y-6">
    <div class="space-y-2">
        <Label for="ga4Id">Google Analytics 4 Measurement ID</Label>
        <Input
            id="ga4Id"
            placeholder="G-XXXXXXXXXX"
            bind:value={adminSettingsStore.settings.analytics.ga4MeasurementId}
        />
        <p class="text-muted-foreground text-xs">
            Google Analytics 4에서 발급받은 측정 ID를 입력하세요.
        </p>
    </div>

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
