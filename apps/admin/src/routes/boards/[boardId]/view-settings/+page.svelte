<script lang="ts">
    /**
     * 게시판별 뷰 설정 페이지
     *
     * 관리자가 각 게시판의 기본 뷰 모드와 허용 뷰 모드를 설정합니다.
     */

    import { page } from '$app/stores';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
    import { toast } from 'svelte-sonner';
    import { Toaster } from '$lib/components/ui/sonner';
    import {
        ChevronLeft,
        Save,
        List,
        LayoutGrid,
        Image,
        AlignJustify,
        Clock
    } from '@lucide/svelte';
    import { SvelteSet } from 'svelte/reactivity';

    type ViewMode = 'list' | 'card' | 'gallery' | 'compact' | 'timeline';

    interface ViewModeOption {
        id: ViewMode;
        label: string;
        description: string;
        icon: typeof List;
    }

    const boardId = $derived($page.params.boardId || '');

    const viewModes: ViewModeOption[] = [
        { id: 'list', label: '리스트', description: '기본 목록 형태', icon: List },
        { id: 'card', label: '카드', description: '카드 그리드 형태', icon: LayoutGrid },
        { id: 'gallery', label: '갤러리', description: '이미지 중심 갤러리', icon: Image },
        { id: 'compact', label: '컴팩트', description: '밀집된 텍스트 목록', icon: AlignJustify },
        { id: 'timeline', label: '타임라인', description: '시간순 타임라인', icon: Clock }
    ];

    let defaultView = $state<ViewMode>('list');
    let allowedViews = $state<SvelteSet<ViewMode>>(
        new SvelteSet(['list', 'card', 'gallery', 'compact', 'timeline'])
    );
    let isLoading = $state(false);

    function toggleView(viewId: ViewMode) {
        const next = new SvelteSet(allowedViews);
        if (next.has(viewId)) {
            // 최소 1개는 남겨야 함
            if (next.size > 1) {
                next.delete(viewId);
                // 기본 뷰가 비활성화되면 첫 번째 허용 뷰로 변경
                if (defaultView === viewId) {
                    defaultView = Array.from(next)[0];
                }
            }
        } else {
            next.add(viewId);
        }
        allowedViews = next;
    }

    async function saveSettings() {
        isLoading = true;
        try {
            // TODO: API 연동
            toast.success('뷰 설정이 저장되었습니다.');
        } catch {
            toast.error('설정 저장에 실패했습니다.');
        } finally {
            isLoading = false;
        }
    }
</script>

<Toaster />

<div class="container mx-auto max-w-4xl py-8">
    <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" href="/boards">
                <ChevronLeft class="h-5 w-5" />
            </Button>
            <div>
                <h1 class="text-3xl font-bold">게시판 뷰 설정</h1>
                <p class="text-muted-foreground">게시판 "{boardId}"의 표시 방식을 설정합니다.</p>
            </div>
        </div>
        <Button onclick={saveSettings} disabled={isLoading}>
            <Save class="mr-2 h-4 w-4" />
            {isLoading ? '저장 중...' : '저장'}
        </Button>
    </div>

    <div class="space-y-6">
        <!-- 기본 뷰 모드 -->
        <Card>
            <CardHeader>
                <CardTitle>기본 뷰 모드</CardTitle>
                <CardDescription>
                    사용자가 별도 설정하지 않았을 때 표시되는 기본 뷰 모드입니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Select
                    type="single"
                    value={defaultView}
                    onValueChange={(v: string) => (defaultView = v as ViewMode)}
                >
                    <SelectTrigger>
                        {viewModes.find((m) => m.id === defaultView)?.label || '선택'}
                    </SelectTrigger>
                    <SelectContent>
                        {#each viewModes.filter((m) => allowedViews.has(m.id)) as mode (mode.id)}
                            <SelectItem value={mode.id}
                                >{mode.label} - {mode.description}</SelectItem
                            >
                        {/each}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>

        <!-- 허용 뷰 모드 -->
        <Card>
            <CardHeader>
                <CardTitle>허용 뷰 모드</CardTitle>
                <CardDescription>사용자가 선택할 수 있는 뷰 모드를 제한합니다.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
                {#each viewModes as mode (mode.id)}
                    {@const Icon = mode.icon}
                    <div class="flex items-center justify-between rounded-lg border p-4">
                        <div class="flex items-center gap-3">
                            <Icon class="text-muted-foreground h-5 w-5" />
                            <div>
                                <p class="font-medium">{mode.label}</p>
                                <p class="text-muted-foreground text-sm">{mode.description}</p>
                            </div>
                        </div>
                        <Switch
                            checked={allowedViews.has(mode.id)}
                            onCheckedChange={() => toggleView(mode.id)}
                        />
                    </div>
                {/each}
            </CardContent>
        </Card>
    </div>
</div>
