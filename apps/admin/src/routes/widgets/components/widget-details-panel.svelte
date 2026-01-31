<script lang="ts">
    import { widgetStore } from '$lib/stores/widget-store.svelte';
    import { getWidgetName, getWidgetIcon, WIDGET_REGISTRY } from '$lib/types/widget';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import { Badge } from '$lib/components/ui/badge';
    import { cn } from '$lib/utils';
    import WidgetSettingsForm from './widget-settings-form.svelte';
    import {
        X,
        Trash2,
        Star,
        Newspaper,
        ShoppingCart,
        LayoutGrid,
        Images,
        Users,
        Megaphone,
        Info,
        Play,
        Image,
        Gift,
        Pin,
        Box,
        List
    } from '@lucide/svelte/icons';

    /**
     * 위젯 상세 설정 사이드 패널
     *
     * 매니페스트 기반 동적 설정 폼을 렌더링합니다.
     */

    const iconMap: Record<string, typeof Star> = {
        Star,
        Newspaper,
        ShoppingCart,
        LayoutGrid,
        Images,
        Users,
        Megaphone,
        Info,
        Play,
        Image,
        Gift,
        Pin,
        Box,
        List
    };

    const widget = $derived(widgetStore.selectedWidget);
    const registry = $derived(widget ? WIDGET_REGISTRY[widget.type] : null);

    // 매니페스트 settings 스키마 (API에서 로드된 것 우선, 없으면 null)
    const settingsSchema = $derived(widget ? widgetStore.getSettingsSchema(widget.type) : null);

    let localSettings = $state<Record<string, unknown>>({});

    $effect(() => {
        if (widget) {
            localSettings = { ...widget.settings };
        }
    });

    function handleClose() {
        widgetStore.selectWidget(null);
    }

    function handleDelete() {
        if (widget && confirm('이 위젯을 삭제하시겠습니까?')) {
            widgetStore.removeWidget(widget.id);
        }
    }

    function handleToggle() {
        if (widget) {
            widgetStore.toggleWidget(widget.id);
        }
    }

    function handleSettingChange(key: string, value: unknown) {
        localSettings = { ...localSettings, [key]: value };
        if (widget) {
            widgetStore.updateWidgetSettings(widget.id, { [key]: value });
        }
    }

    function getIcon(type: string) {
        const iconName = getWidgetIcon(type);
        return iconMap[iconName] || Box;
    }

    function getCategoryVariant(
        category: string
    ): 'default' | 'secondary' | 'destructive' | 'outline' {
        switch (category) {
            case 'content':
                return 'default';
            case 'ad':
                return 'destructive';
            case 'layout':
                return 'secondary';
            case 'sidebar':
                return 'outline';
            default:
                return 'default';
        }
    }

    function getCategoryLabel(category: string): string {
        switch (category) {
            case 'content':
                return '콘텐츠';
            case 'ad':
                return '광고';
            case 'layout':
                return '레이아웃';
            case 'sidebar':
                return '사이드바';
            default:
                return category;
        }
    }
</script>

{#if widget}
    {@const Icon = getIcon(widget.type)}
    <aside class="bg-card border-border flex w-96 flex-col border-l">
        <!-- 헤더 -->
        <div class="border-border flex items-center justify-between border-b px-4 py-3">
            <h3 class="font-semibold">위젯 설정</h3>
            <Button variant="ghost" size="icon" onclick={handleClose}>
                <X class="h-4 w-4" />
            </Button>
        </div>

        <!-- 콘텐츠 -->
        <div class="flex-1 overflow-auto p-4">
            <!-- 위젯 정보 -->
            <div class="mb-6">
                <div class="flex items-center gap-3">
                    <div
                        class={cn(
                            'flex h-12 w-12 items-center justify-center rounded-lg',
                            widget.enabled
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                        )}
                    >
                        <Icon class="h-6 w-6" />
                    </div>
                    <div>
                        <h4 class="font-medium">{getWidgetName(widget.type)}</h4>
                        {#if registry}
                            <Badge variant={getCategoryVariant(registry.category)} class="mt-1">
                                {getCategoryLabel(registry.category)}
                            </Badge>
                        {/if}
                    </div>
                </div>
                {#if registry}
                    <p class="text-muted-foreground mt-3 text-sm">
                        {registry.description}
                    </p>
                {/if}
            </div>

            <!-- 기본 설정 -->
            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <Label>활성화</Label>
                    <Switch checked={widget.enabled} onCheckedChange={handleToggle} />
                </div>

                <div class="border-border border-t pt-4">
                    <Label class="text-muted-foreground text-xs uppercase tracking-wide">
                        위젯 ID
                    </Label>
                    <p class="mt-1 font-mono text-sm">{widget.id}</p>
                </div>

                <div>
                    <Label class="text-muted-foreground text-xs uppercase tracking-wide">
                        위치
                    </Label>
                    <p class="mt-1 text-sm">#{widget.position + 1}</p>
                </div>
            </div>

            <!-- 매니페스트 기반 동적 설정 폼 -->
            {#if settingsSchema}
                <WidgetSettingsForm
                    settings={settingsSchema}
                    values={localSettings}
                    onchange={handleSettingChange}
                />
            {/if}

            <!-- 설정 데이터 미리보기 (JSON) -->
            {#if widget.settings && Object.keys(widget.settings).length > 0}
                <div class="border-border mt-6 space-y-2 border-t pt-4">
                    <Label class="text-muted-foreground text-xs uppercase tracking-wide">
                        설정 데이터
                    </Label>
                    <pre class="bg-muted rounded-md p-3 text-xs">{JSON.stringify(
                            widget.settings,
                            null,
                            2
                        )}</pre>
                </div>
            {/if}
        </div>

        <!-- 푸터 -->
        <div class="border-border border-t p-4">
            <Button variant="destructive" class="w-full" onclick={handleDelete}>
                <Trash2 class="mr-2 h-4 w-4" />
                위젯 삭제
            </Button>
        </div>
    </aside>
{/if}
