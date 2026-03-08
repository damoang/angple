<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { AVAILABLE_BOARDS, BOARD_FILTERABLE_WIDGET_TYPES } from '$lib/types/widget-settings';
    import type { TagNavMenu } from '$lib/components/ui/tag-nav';
    import Save from '@lucide/svelte/icons/save';
    import Plus from '@lucide/svelte/icons/plus';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

    interface Props {
        widget: WidgetConfig;
        zone: 'main' | 'sidebar';
        open: boolean;
        onOpenChange: (open: boolean) => void;
    }

    const { widget, zone, open, onOpenChange }: Props = $props();

    const DEFAULT_TAG_NAV_MENUS: TagNavMenu[] = [
        { key: 'free', text: '자유게시판', url: '/free', show: true },
        { key: 'qa', text: '질문과답변', url: '/qa', show: true },
        { key: 'new', text: '새로운소식', url: '/new', show: true },
        { key: 'economy', text: '알뜰구매', url: '/economy', show: true },
        { key: 'promotion', text: '직접홍보', url: '/promotion', show: true },
        { key: 'lecture', text: '강좌&팁', url: '/lecture', show: true },
        { key: 'group', text: '소모임', url: '/groups', show: true },
        { key: 'tutorial', text: '사용기', url: '/tutorial', show: true },
        { key: 'message', text: '축하메시지', url: '/message', show: true }
    ];

    // 로컬 설정 상태 (게시판 필터용)
    let boardId = $state('');
    let limit = $state(10);
    let sortBy = $state('latest');

    // 태그 네비 메뉴 상태
    let tagNavMenus = $state<TagNavMenu[]>([]);

    const isTagNav = $derived(widget.type === 'tag-nav');
    const isBoardFilterable = $derived(
        BOARD_FILTERABLE_WIDGET_TYPES.includes(
            widget.type as (typeof BOARD_FILTERABLE_WIDGET_TYPES)[number]
        )
    );
    const hasSettings = $derived(isBoardFilterable || isTagNav);

    function handleSave() {
        const newSettings = { ...widget.settings };
        if (isBoardFilterable) {
            if (boardId) newSettings.boardId = boardId;
            else delete newSettings.boardId;
            newSettings.limit = limit;
            newSettings.sortBy = sortBy;
        }
        if (isTagNav) {
            newSettings.menus = JSON.parse(JSON.stringify(tagNavMenus));
        }
        widgetLayoutStore.updateWidgetSettings(zone, widget.id, newSettings);
        onOpenChange(false);
    }

    function addMenu() {
        const newKey = `custom-${Date.now()}`;
        tagNavMenus = [...tagNavMenus, { key: newKey, text: '새 메뉴', url: '/', show: true }];
    }

    function removeMenu(index: number) {
        tagNavMenus = tagNavMenus.filter((_, i) => i !== index);
    }

    function resetMenus() {
        tagNavMenus = structuredClone(DEFAULT_TAG_NAV_MENUS);
    }

    // widget이 변경되면 로컬 상태도 업데이트
    $effect(() => {
        boardId = (widget.settings?.boardId as string) ?? '';
        limit = (widget.settings?.limit as number) ?? 10;
        sortBy = (widget.settings?.sortBy as string) ?? 'latest';

        if (isTagNav) {
            const saved = widget.settings?.menus as TagNavMenu[] | undefined;
            tagNavMenus = saved
                ? JSON.parse(JSON.stringify(saved))
                : JSON.parse(JSON.stringify(DEFAULT_TAG_NAV_MENUS));
        }
    });
</script>

<Dialog.Root {open} {onOpenChange}>
    <Dialog.Content class={isTagNav ? 'max-w-lg' : 'max-w-md'}>
        <Dialog.Header>
            <Dialog.Title>위젯 설정</Dialog.Title>
            <Dialog.Description>
                {isTagNav
                    ? '태그 네비게이션 메뉴를 설정합니다.'
                    : '위젯의 데이터 소스와 표시 옵션을 설정합니다.'}
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-4">
            {#if isTagNav}
                <!-- 태그 네비 메뉴 편집 -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <Label>메뉴 목록</Label>
                        <button
                            type="button"
                            onclick={resetMenus}
                            class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                            title="기본값으로 초기화"
                        >
                            <RotateCcw class="h-3 w-3" />
                            초기화
                        </button>
                    </div>

                    <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
                        {#each tagNavMenus as menu, i (menu.key)}
                            <div
                                class="border-border bg-muted/30 flex items-start gap-2 rounded-lg border p-2.5"
                            >
                                <GripVertical
                                    class="text-muted-foreground mt-2.5 h-4 w-4 shrink-0"
                                />
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <Input
                                            bind:value={menu.text}
                                            placeholder="메뉴 이름"
                                            class="h-8 text-sm"
                                        />
                                        <label
                                            class="flex shrink-0 cursor-pointer items-center gap-1"
                                        >
                                            <input
                                                type="checkbox"
                                                bind:checked={menu.show}
                                                class="accent-primary h-3.5 w-3.5 rounded"
                                            />
                                            <span class="text-muted-foreground text-xs">표시</span>
                                        </label>
                                    </div>
                                    <Input
                                        bind:value={menu.url}
                                        placeholder="/board 또는 https://..."
                                        class="h-8 text-sm"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onclick={() => removeMenu(i)}
                                    class="text-muted-foreground hover:text-destructive mt-2.5 shrink-0 transition-colors"
                                    title="삭제"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </div>
                        {/each}
                    </div>

                    <Button variant="outline" size="sm" onclick={addMenu} class="w-full">
                        <Plus class="mr-1.5 h-4 w-4" />
                        메뉴 추가
                    </Button>
                </div>
            {:else if isBoardFilterable}
                <div class="space-y-2">
                    <Label for="boardId">게시판</Label>
                    <select
                        id="boardId"
                        bind:value={boardId}
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                        <option value="">전체 (기본)</option>
                        {#each AVAILABLE_BOARDS as board (board.id)}
                            <option value={board.id}>{board.name}</option>
                        {/each}
                    </select>
                </div>

                <div class="space-y-2">
                    <Label for="limit">표시 글 수</Label>
                    <Input id="limit" type="number" min={1} max={50} bind:value={limit} />
                </div>

                <div class="space-y-2">
                    <Label for="sortBy">정렬</Label>
                    <select
                        id="sortBy"
                        bind:value={sortBy}
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                        <option value="latest">최신순</option>
                        <option value="popular">인기순</option>
                        <option value="recommended">추천순</option>
                    </select>
                </div>
            {:else}
                <p class="text-muted-foreground text-sm">이 위젯은 추가 설정이 없습니다.</p>
            {/if}
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => onOpenChange(false)}>취소</Button>
            {#if hasSettings}
                <Button onclick={handleSave}>
                    <Save class="mr-2 h-4 w-4" />
                    적용
                </Button>
            {/if}
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
