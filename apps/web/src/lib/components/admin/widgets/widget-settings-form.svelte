<script lang="ts">
    /**
     * 매니페스트 기반 동적 위젯 설정 폼
     *
     * widget.json의 settings 정의를 읽어 자동으로 폼 필드를 렌더링합니다.
     * 필드 타입: text, number, boolean, select, color
     */
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import { onMount } from 'svelte';

    interface SettingOption {
        label: string;
        value: unknown;
    }

    interface SettingField {
        label: string;
        type: 'text' | 'color' | 'boolean' | 'number' | 'select';
        default: unknown;
        description?: string;
        placeholder?: string;
        options?: SettingOption[];
        min?: number;
        max?: number;
        step?: number;
        dynamic?: boolean;
        dynamicEndpoint?: string;
    }

    let {
        settings,
        values = {},
        onchange
    }: {
        /** widget.json의 settings 스키마 */
        settings: Record<string, SettingField>;
        /** 현재 설정 값 */
        values: Record<string, unknown>;
        /** 설정 변경 콜백 */
        onchange: (key: string, value: unknown) => void;
    } = $props();

    // 동적 옵션 캐시
    let dynamicOptions = $state<Record<string, SettingOption[]>>({});

    // 동적 옵션 로드
    async function loadDynamicOptions(key: string, field: SettingField) {
        if (!field.dynamic || !field.dynamicEndpoint) return;
        try {
            const res = await fetch(field.dynamicEndpoint);
            if (res.ok) {
                const data = await res.json();
                dynamicOptions = { ...dynamicOptions, [key]: data.options ?? data };
            }
        } catch (err) {
            console.error(`[WidgetSettingsForm] 동적 옵션 로드 실패 (${key}):`, err);
        }
    }

    onMount(() => {
        for (const [key, field] of Object.entries(settings)) {
            if (field.dynamic) {
                loadDynamicOptions(key, field);
            }
        }
    });

    function getOptions(key: string, field: SettingField): SettingOption[] {
        if (field.dynamic && dynamicOptions[key]) {
            return dynamicOptions[key];
        }
        return field.options ?? [];
    }

    function getValue(key: string, field: SettingField): unknown {
        return values[key] ?? field.default;
    }

    const selectClass =
        'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
</script>

{#if settings && Object.keys(settings).length > 0}
    <div class="border-border mt-6 space-y-4 border-t pt-4">
        <h5 class="font-medium">위젯 설정</h5>

        {#each Object.entries(settings) as [key, field]}
            <div class="space-y-2">
                {#if field.type === 'boolean'}
                    <div class="flex items-center justify-between">
                        <div>
                            <Label for="setting-{key}">{field.label}</Label>
                            {#if field.description}
                                <p class="text-muted-foreground text-xs">{field.description}</p>
                            {/if}
                        </div>
                        <Switch
                            id="setting-{key}"
                            checked={Boolean(getValue(key, field))}
                            onCheckedChange={(checked) => onchange(key, checked)}
                        />
                    </div>
                {:else if field.type === 'select'}
                    <Label for="setting-{key}">{field.label}</Label>
                    {#if field.description}
                        <p class="text-muted-foreground text-xs">{field.description}</p>
                    {/if}
                    <select
                        id="setting-{key}"
                        class={selectClass}
                        value={String(getValue(key, field) ?? '')}
                        onchange={(e) => onchange(key, e.currentTarget.value)}
                    >
                        {#each getOptions(key, field) as option}
                            <option value={String(option.value)}>{option.label}</option>
                        {/each}
                    </select>
                {:else if field.type === 'number'}
                    <Label for="setting-{key}">{field.label}</Label>
                    {#if field.description}
                        <p class="text-muted-foreground text-xs">{field.description}</p>
                    {/if}
                    <Input
                        id="setting-{key}"
                        type="number"
                        value={String(getValue(key, field) ?? '')}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        placeholder={field.placeholder}
                        oninput={(e) => onchange(key, Number(e.currentTarget.value))}
                    />
                {:else if field.type === 'color'}
                    <Label for="setting-{key}">{field.label}</Label>
                    {#if field.description}
                        <p class="text-muted-foreground text-xs">{field.description}</p>
                    {/if}
                    <input
                        id="setting-{key}"
                        type="color"
                        class="h-10 w-full cursor-pointer rounded-md border p-1"
                        value={String(getValue(key, field) ?? '#000000')}
                        oninput={(e) => onchange(key, e.currentTarget.value)}
                    />
                {:else}
                    <!-- text (default) -->
                    <Label for="setting-{key}">{field.label}</Label>
                    {#if field.description}
                        <p class="text-muted-foreground text-xs">{field.description}</p>
                    {/if}
                    <Input
                        id="setting-{key}"
                        value={String(getValue(key, field) ?? '')}
                        placeholder={field.placeholder}
                        oninput={(e) => onchange(key, e.currentTarget.value)}
                    />
                {/if}
            </div>
        {/each}
    </div>
{/if}
