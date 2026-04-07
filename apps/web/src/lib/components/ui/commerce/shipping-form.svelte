<script lang="ts">
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import Truck from '@lucide/svelte/icons/truck';

    interface Props {
        name: string;
        phone: string;
        address: string;
        postal: string;
        memo: string;
        errors?: Record<string, string>;
    }

    let {
        name = $bindable(),
        phone = $bindable(),
        address = $bindable(),
        postal = $bindable(),
        memo = $bindable(),
        errors = {}
    }: Props = $props();
</script>

<Card>
    <CardHeader class="pb-3">
        <CardTitle class="flex items-center gap-2 text-base">
            <Truck class="h-5 w-5" />
            배송 정보
        </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <Label for="ship-name">받는 분</Label>
                <Input id="ship-name" bind:value={name} placeholder="이름" class="mt-1" />
                {#if errors.name}<p class="mt-1 text-xs text-red-500">{errors.name}</p>{/if}
            </div>
            <div>
                <Label for="ship-phone">연락처</Label>
                <Input
                    id="ship-phone"
                    bind:value={phone}
                    placeholder="010-0000-0000"
                    class="mt-1"
                />
                {#if errors.phone}<p class="mt-1 text-xs text-red-500">{errors.phone}</p>{/if}
            </div>
        </div>
        <div>
            <Label for="ship-postal">우편번호</Label>
            <Input id="ship-postal" bind:value={postal} placeholder="우편번호" class="mt-1" />
            {#if errors.postal}<p class="mt-1 text-xs text-red-500">{errors.postal}</p>{/if}
        </div>
        <div>
            <Label for="ship-address">주소</Label>
            <Input id="ship-address" bind:value={address} placeholder="상세 주소" class="mt-1" />
            {#if errors.address}<p class="mt-1 text-xs text-red-500">{errors.address}</p>{/if}
        </div>
        <div>
            <Label for="ship-memo">배송 메모</Label>
            <Input
                id="ship-memo"
                bind:value={memo}
                placeholder="부재 시 문 앞에 놓아주세요"
                class="mt-1"
            />
        </div>
    </CardContent>
</Card>
