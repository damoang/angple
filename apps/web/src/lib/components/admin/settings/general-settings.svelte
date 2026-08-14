<script lang="ts">
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Save from '@lucide/svelte/icons/save';

    function setGoodCancelWindowHours(value: string) {
        // 음수/NaN 은 0(제한 없음)으로 정규화. 소수점은 버림.
        const n = Math.max(0, Math.floor(Number(value)));
        adminSettingsStore.settings.general.goodCancelWindowHours = Number.isFinite(n) ? n : 0;
    }
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

    <div class="space-y-2">
        <Label for="goodCancelWindowHours">추천(공감) 취소 가능 시간(시간). 0=제한 없음</Label>
        <Input
            id="goodCancelWindowHours"
            type="number"
            min="0"
            step="1"
            placeholder="12"
            value={String(adminSettingsStore.settings.general.goodCancelWindowHours ?? 12)}
            oninput={(e: Event) =>
                setGoodCancelWindowHours((e.currentTarget as HTMLInputElement).value)}
        />
        <p class="text-muted-foreground text-xs">
            추천을 누른 뒤 이 시간이 지나면 취소할 수 없습니다(일방향). 비추천/이모티콘 반응에는
            적용되지 않습니다.
        </p>
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
