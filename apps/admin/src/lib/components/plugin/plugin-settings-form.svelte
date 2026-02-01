<script lang="ts">
    /**
     * 플러그인 설정 자동 폼
     *
     * plugin.json의 settings 스키마를 기반으로 UI를 자동 생성합니다.
     * boolean → Switch, number → Input[number], select → Select, string → Input[text]
     */

    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger
    } from '$lib/components/ui/select';

    interface SettingField {
        type: string;
        label: string;
        description?: string;
        default?: unknown;
        options?: string[] | { label: string; value: string }[];
        min?: number;
        max?: number;
        step?: number;
        placeholder?: string;
        required?: boolean;
    }

    interface Props {
        /** settings 스키마 (plugin.json의 settings 필드) */
        schema: Record<string, SettingField>;
        /** 현재 설정값 (양방향 바인딩) */
        values: Record<string, unknown>;
    }

    let { schema, values = $bindable() }: Props = $props();

    /**
     * select 옵션 정규화
     */
    function normalizeOptions(options?: string[] | { label: string; value: string }[]): { label: string; value: string }[] {
        if (!options) return [];
        return options.map(opt =>
            typeof opt === 'string' ? { label: opt, value: opt } : opt
        );
    }

    /**
     * 현재값 가져오기 (기본값 폴백)
     */
    function getValue(key: string, field: SettingField): unknown {
        return values[key] ?? field.default;
    }
</script>

<div class="space-y-6">
    {#each Object.entries(schema) as [key, field] (key)}
        <div class="space-y-2">
            <!-- boolean → Switch -->
            {#if field.type === 'boolean'}
                <div class="flex items-center justify-between rounded-lg border p-4">
                    <Label for={key} class="flex flex-col gap-1">
                        <span>{field.label}</span>
                        {#if field.description}
                            <span class="text-muted-foreground text-sm font-normal">
                                {field.description}
                            </span>
                        {/if}
                    </Label>
                    <Switch
                        id={key}
                        checked={(getValue(key, field) as boolean) ?? false}
                        onCheckedChange={(checked: boolean) => (values[key] = checked)}
                    />
                </div>

            <!-- number → Input[number] -->
            {:else if field.type === 'number'}
                <Label for={key}>{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground text-sm">{field.description}</p>
                {/if}
                <Input
                    id={key}
                    type="number"
                    value={getValue(key, field) as number}
                    oninput={(e: Event) => {
                        const target = e.target as HTMLInputElement;
                        values[key] = target.value ? Number(target.value) : field.default;
                    }}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    placeholder={field.placeholder}
                />

            <!-- select → Select -->
            {:else if field.type === 'select'}
                <Label for={key}>{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground text-sm">{field.description}</p>
                {/if}
                {@const options = normalizeOptions(field.options)}
                {@const currentValue = (getValue(key, field) as string) ?? ''}
                <Select
                    type="single"
                    value={currentValue}
                    onValueChange={(v: string) => (values[key] = v)}
                >
                    <SelectTrigger id={key}>
                        {options.find(o => o.value === currentValue)?.label || '선택하세요'}
                    </SelectTrigger>
                    <SelectContent>
                        {#each options as option (option.value)}
                            <SelectItem value={option.value}>{option.label}</SelectItem>
                        {/each}
                    </SelectContent>
                </Select>

            <!-- textarea -->
            {:else if field.type === 'textarea'}
                <Label for={key}>{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground text-sm">{field.description}</p>
                {/if}
                <textarea
                    id={key}
                    value={(getValue(key, field) as string) ?? ''}
                    oninput={(e: Event) => {
                        const target = e.target as HTMLTextAreaElement;
                        values[key] = target.value;
                    }}
                    placeholder={field.placeholder ?? (field.default as string)}
                    rows="4"
                    class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                ></textarea>

            <!-- color -->
            {:else if field.type === 'color'}
                <Label for={key}>{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground text-sm">{field.description}</p>
                {/if}
                <div class="flex items-center gap-4">
                    <Input
                        id={key}
                        type="color"
                        value={(getValue(key, field) as string) ?? '#000000'}
                        oninput={(e: Event) => {
                            const target = e.target as HTMLInputElement;
                            values[key] = target.value;
                        }}
                        class="h-12 w-24"
                    />
                    <Input
                        type="text"
                        value={(getValue(key, field) as string) ?? ''}
                        oninput={(e: Event) => {
                            const target = e.target as HTMLInputElement;
                            values[key] = target.value;
                        }}
                        placeholder={field.default as string}
                        class="flex-1"
                    />
                </div>

            <!-- string / text / url / email → Input[text] (기본) -->
            {:else}
                <Label for={key}>{field.label}</Label>
                {#if field.description}
                    <p class="text-muted-foreground text-sm">{field.description}</p>
                {/if}
                <Input
                    id={key}
                    type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                    value={(getValue(key, field) as string) ?? ''}
                    oninput={(e: Event) => {
                        const target = e.target as HTMLInputElement;
                        values[key] = target.value;
                    }}
                    placeholder={field.placeholder ?? (field.default as string)}
                />
            {/if}
        </div>
    {/each}
</div>
