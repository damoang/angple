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
    import { Button } from '$lib/components/ui/button';
    import { onMount } from 'svelte';
    import {
        DEFAULT_TAG_NAV_MENUS,
        type TagNavMenu
    } from '$lib/components/ui/tag-nav/default-menus';

    interface SettingOption {
        label: string;
        value: unknown;
    }

    interface SettingField {
        label: string;
        type: 'text' | 'color' | 'boolean' | 'number' | 'select' | 'menu-list';
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

    // === menu-list (tag-nav 등 메뉴 배열) 편집 헬퍼 ===
    function getMenuList(key: string, field: SettingField): TagNavMenu[] {
        const v = (values[key] ?? field.default) as TagNavMenu[] | undefined;
        return Array.isArray(v) ? v.map((m) => ({ ...m })) : [];
    }

    /** url 에서 slug(key) 파생: '/giving' → 'giving', 빈 값이면 인덱스 기반 */
    function slugFromUrl(url: string, index: number): string {
        const s = (url || '').replace(/^\/+/, '').split(/[/?#]/)[0];
        return s || `item-${index}`;
    }

    function commitMenuList(key: string, list: TagNavMenu[]) {
        // 저장 전 정리: text 비어있는 항목 제거, key 비면 url 에서 파생, key 중복은 suffix
        const seen = new Set<string>();
        const cleaned: TagNavMenu[] = [];
        list.forEach((m, i) => {
            const text = (m.text || '').trim();
            if (!text) return; // 라벨 없는 항목은 저장하지 않음
            const url = (m.url || '').trim();
            let k = (m.key || '').trim() || slugFromUrl(url, i);
            while (seen.has(k)) k = `${k}-${i}`;
            seen.add(k);
            cleaned.push({ key: k, text, url, show: m.show !== false });
        });
        onchange(key, cleaned);
    }

    function updateMenuField(
        key: string,
        field: SettingField,
        index: number,
        prop: keyof TagNavMenu,
        value: string | boolean
    ) {
        const list = getMenuList(key, field);
        if (!list[index]) return;
        (list[index][prop] as string | boolean) = value;
        commitMenuList(key, list);
    }

    function addMenuItem(key: string, field: SettingField) {
        const list = getMenuList(key, field);
        list.push({ key: '', text: '', url: '/', show: true });
        commitMenuList(key, list);
    }

    function removeMenuItem(key: string, field: SettingField, index: number) {
        const list = getMenuList(key, field);
        list.splice(index, 1);
        commitMenuList(key, list);
    }

    function moveMenuItem(key: string, field: SettingField, index: number, dir: -1 | 1) {
        const list = getMenuList(key, field);
        const next = index + dir;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
        commitMenuList(key, list);
    }

    function resetMenuToDefault(key: string) {
        commitMenuList(
            key,
            DEFAULT_TAG_NAV_MENUS.map((m) => ({ ...m }))
        );
    }

    const selectClass =
        'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
</script>

{#if settings && Object.keys(settings).length > 0}
    <div class="border-border mt-6 space-y-4 border-t pt-4">
        <h5 class="font-medium">위젯 설정</h5>

        {#each Object.entries(settings) as [key, field]}
            <div class="space-y-2">
                {#if field.type === 'menu-list'}
                    <div class="flex items-center justify-between">
                        <Label>{field.label}</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onclick={() => resetMenuToDefault(key)}>기본값 불러오기</Button
                        >
                    </div>
                    {#if field.description}
                        <p class="text-muted-foreground text-xs">{field.description}</p>
                    {/if}
                    <div class="space-y-2">
                        {#each getMenuList(key, field) as item, index (index)}
                            <div
                                class="border-border flex items-center gap-2 rounded-md border p-2"
                            >
                                <div class="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        class="text-muted-foreground hover:text-foreground text-xs leading-none disabled:opacity-30"
                                        disabled={index === 0}
                                        aria-label="위로"
                                        onclick={() => moveMenuItem(key, field, index, -1)}
                                        >▲</button
                                    >
                                    <button
                                        type="button"
                                        class="text-muted-foreground hover:text-foreground text-xs leading-none disabled:opacity-30"
                                        disabled={index === getMenuList(key, field).length - 1}
                                        aria-label="아래로"
                                        onclick={() => moveMenuItem(key, field, index, 1)}>▼</button
                                    >
                                </div>
                                <Input
                                    class="flex-1"
                                    placeholder="라벨"
                                    value={item.text}
                                    oninput={(e) =>
                                        updateMenuField(
                                            key,
                                            field,
                                            index,
                                            'text',
                                            e.currentTarget.value
                                        )}
                                />
                                <Input
                                    class="flex-1"
                                    placeholder="/주소"
                                    value={item.url}
                                    oninput={(e) =>
                                        updateMenuField(
                                            key,
                                            field,
                                            index,
                                            'url',
                                            e.currentTarget.value
                                        )}
                                />
                                <Switch
                                    checked={item.show !== false}
                                    onCheckedChange={(checked) =>
                                        updateMenuField(key, field, index, 'show', checked)}
                                />
                                <button
                                    type="button"
                                    class="text-destructive hover:text-destructive/80 px-1 text-sm"
                                    aria-label="삭제"
                                    onclick={() => removeMenuItem(key, field, index)}>✕</button
                                >
                            </div>
                        {/each}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="w-full"
                        onclick={() => addMenuItem(key, field)}>+ 항목 추가</Button
                    >
                {:else if field.type === 'boolean'}
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
