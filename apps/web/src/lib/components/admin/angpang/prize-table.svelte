<script lang="ts">
    /**
     * 상품 표 편집(행 추가·삭제, weight/points/exp).
     * 당첨되면 weight 비율로 한 줄을 고른다. points 는 최대 금액(1..points 균등), exp 는 고정 경험치.
     * 둘 다 0 인 줄은 「꽝」. 표가 비면 상위 points 로 포인트만 준다.
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import Plus from '@lucide/svelte/icons/plus';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import FieldError from './field-error.svelte';
    import { emptyPrize, type LuckyPrize } from '$lib/utils/angpang-admin';

    let {
        prizes = $bindable([]),
        errors,
        path,
        idPrefix
    }: {
        prizes: LuckyPrize[];
        errors: Record<string, string[]>;
        /** 백엔드 오류 경로 접두사(예: windows[0].prizes) */
        path: string;
        idPrefix: string;
    } = $props();

    function addRow() {
        prizes = [...prizes, emptyPrize()];
    }

    function removeRow(index: number) {
        prizes = prizes.filter((_, i) => i !== index);
    }
</script>

<div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">상품 표</span>
        <Button type="button" variant="outline" size="sm" onclick={addRow}>
            <Plus class="mr-1 h-3.5 w-3.5" />줄 추가
        </Button>
    </div>
    {#if prizes.length === 0}
        <p class="text-muted-foreground text-xs">
            상품 표가 비어 있으면 위 「최대 포인트」로 포인트만 지급합니다.
        </p>
    {:else}
        <div class="overflow-x-auto">
            <table class="w-full min-w-[280px] text-sm">
                <thead>
                    <tr class="text-muted-foreground text-left text-xs">
                        <th class="pb-1 pr-2 font-normal">가중치</th>
                        <th class="pb-1 pr-2 font-normal">최대 포인트</th>
                        <th class="pb-1 pr-2 font-normal">경험치</th>
                        <th class="pb-1 font-normal"><span class="sr-only">삭제</span></th>
                    </tr>
                </thead>
                <tbody>
                    {#each prizes as prize, i (i)}
                        <tr class="align-top">
                            <td class="pb-2 pr-2">
                                <Input
                                    id="{idPrefix}-w-{i}"
                                    type="number"
                                    min="0"
                                    aria-label="가중치"
                                    bind:value={prize.weight}
                                />
                                <FieldError {errors} path="{path}[{i}].weight" />
                            </td>
                            <td class="pb-2 pr-2">
                                <Input
                                    id="{idPrefix}-p-{i}"
                                    type="number"
                                    min="0"
                                    aria-label="최대 포인트"
                                    bind:value={prize.points}
                                />
                                <FieldError {errors} path="{path}[{i}].points" />
                            </td>
                            <td class="pb-2 pr-2">
                                <Input
                                    id="{idPrefix}-x-{i}"
                                    type="number"
                                    min="0"
                                    aria-label="경험치"
                                    bind:value={prize.exp}
                                />
                                <FieldError {errors} path="{path}[{i}].exp" />
                            </td>
                            <td class="pb-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="이 줄 삭제"
                                    onclick={() => removeRow(i)}
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        <p class="text-muted-foreground text-xs">
            가중치 비율로 한 줄을 고릅니다(가중치 0 줄은 무시). 포인트는 1~최대 포인트 중 무작위,
            경험치는 고정. 포인트·경험치가 모두 0 인 줄은 꽝입니다.
        </p>
    {/if}
    <FieldError {errors} {path} />
</div>
