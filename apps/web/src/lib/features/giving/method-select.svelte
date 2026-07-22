<script lang="ts">
    import {
        GIVING_METHODS,
        METHOD_INFO,
        isNumberMethod,
        usesCapacity,
        type GivingMethod
    } from './methods.js';

    let {
        method = $bindable('lowest_unique'),
        capacity = $bindable(1),
        numberMax = $bindable(100),
        unitPrice = $bindable(100)
    }: {
        method?: GivingMethod;
        capacity?: number;
        numberMax?: number;
        unitPrice?: number;
    } = $props();
</script>

<div class="space-y-3">
    <div>
        <label for="giving-method" class="text-foreground mb-1 block text-sm font-medium"
            >나눔 방식</label
        >
        <select
            id="giving-method"
            bind:value={method}
            class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        >
            {#each GIVING_METHODS as m (m)}
                <option value={m}>{METHOD_INFO[m].label}</option>
            {/each}
        </select>
        <p class="text-muted-foreground mt-1 text-xs">{METHOD_INFO[method].desc}</p>
    </div>

    {#if isNumberMethod(method)}
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label for="giving-unit" class="text-foreground mb-1 block text-sm font-medium"
                    >번호 단가 (pt)</label
                >
                <input
                    id="giving-unit"
                    type="number"
                    min="0"
                    bind:value={unitPrice}
                    class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label for="giving-max" class="text-foreground mb-1 block text-sm font-medium"
                    >최대 번호</label
                >
                <input
                    id="giving-max"
                    type="number"
                    min="1"
                    bind:value={numberMax}
                    class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                />
            </div>
        </div>
        <p class="text-muted-foreground text-xs">
            비용 = 응모 번호 수 × 단가. 아무도 안 고른 번호 중 최저 번호 보유자가 당첨됩니다.
        </p>
    {:else if usesCapacity(method)}
        <div>
            <label for="giving-cap" class="text-foreground mb-1 block text-sm font-medium"
                >당첨 인원 (N)</label
            >
            <input
                id="giving-cap"
                type="number"
                min="1"
                bind:value={capacity}
                class="border-border bg-background text-foreground w-32 rounded-md border px-3 py-2 text-sm"
            />
        </div>
    {:else}
        <p class="text-muted-foreground text-xs">
            {method === 'curation'
                ? '참가자는 댓글로 사연을 남기고, 주최자가 사유를 밝혀 선정합니다.'
                : '참가자 중에서 주최자가 직접 당첨자를 지정합니다.'}
        </p>
    {/if}
</div>
