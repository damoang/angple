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
        <Label for="siteName">사이트 이름</Label>
        <Input
            id="siteName"
            placeholder="사이트 이름을 입력하세요"
            bind:value={adminSettingsStore.settings.general.siteName}
        />
    </div>

    <div class="space-y-2">
        <Label for="siteDescription">사이트 설명</Label>
        <Input
            id="siteDescription"
            placeholder="사이트 설명을 입력하세요"
            bind:value={adminSettingsStore.settings.general.siteDescription}
        />
    </div>

    <div class="flex justify-end">
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
</div>
