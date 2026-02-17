<script lang="ts">
    import { adminSettingsStore } from '$lib/stores/admin-settings-store.svelte.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Save from '@lucide/svelte/icons/save';
    import Loader2 from '@lucide/svelte/icons/loader-2';
</script>

<div class="space-y-6">
    <div class="space-y-4">
        <div class="space-y-2">
            <Label for="meta-description">메타 설명 (Meta Description)</Label>
            <Input
                id="meta-description"
                bind:value={adminSettingsStore.settings.seo.metaDescription}
                placeholder="사이트를 한 문장으로 소개하세요 (검색 결과에 표시됩니다)"
                maxlength={160}
            />
            <p class="text-muted-foreground text-xs">
                {adminSettingsStore.settings.seo.metaDescription.length}/160자
            </p>
        </div>

        <div class="space-y-2">
            <Label for="og-image">OG 이미지 URL</Label>
            <Input
                id="og-image"
                bind:value={adminSettingsStore.settings.seo.ogImage}
                placeholder="https://example.com/og-image.png"
            />
            <p class="text-muted-foreground text-xs">
                SNS 공유 시 표시될 대표 이미지 (권장: 1200x630px)
            </p>
        </div>

        <div class="space-y-2">
            <Label for="robots-txt">robots.txt 추가 규칙</Label>
            <textarea
                id="robots-txt"
                class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                bind:value={adminSettingsStore.settings.seo.robotsTxt}
                placeholder={"Disallow: /admin/\nDisallow: /api/"}
            ></textarea>
            <p class="text-muted-foreground text-xs">
                기본 규칙 외에 추가할 크롤러 규칙을 입력하세요.
            </p>
        </div>
    </div>

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
