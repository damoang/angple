<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import BookOpen from '@lucide/svelte/icons/book-open';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';

    let { defaultOpen = false }: { defaultOpen?: boolean } = $props();

    let isOpen = $state(defaultOpen);

    interface RuleSection {
        title: string;
        items: string[];
    }

    const rules: RuleSection[] = [
        {
            title: '응모 방법',
            items: [
                '1~999 범위에서 원하는 번호를 선택하여 응모합니다.',
                '콤마(,)로 여러 번호를 구분하고, 하이픈(-)이나 물결(~)로 범위를 지정할 수 있습니다.',
                '예시: 1,3,5-10,15~20 → 1, 3, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20번 응모',
                '한 번 응모한 번호는 취소할 수 없으며, 여러 번 응모할 수 있습니다.'
            ]
        },
        {
            title: '당첨 기준',
            items: [
                '나눔 종료 시 "최저고유번호"를 선택한 사람이 당첨됩니다.',
                '고유번호란 오직 한 사람만 선택한 번호를 말합니다.',
                '고유번호 중 가장 작은 번호가 당첨번호가 됩니다.',
                '고유번호가 없는 경우, 가장 적은 인원이 선택한 번호 중 최저 번호가 당첨됩니다.'
            ]
        },
        {
            title: '포인트 시스템',
            items: [
                '응모 시 번호당 설정된 포인트가 차감됩니다.',
                '나눔 주최자에게 총 응모 포인트의 50%가 수수료로 지급됩니다.',
                '나머지 50%는 시스템에 귀속됩니다.',
                '포인트가 부족하면 응모할 수 없습니다.'
            ]
        },
        {
            title: '일시정지 / 재개',
            items: [
                '나눔 주최자 또는 관리자가 나눔을 일시정지할 수 있습니다.',
                '일시정지 중에는 응모가 불가능하며, 카운트다운이 멈춥니다.',
                '재개 시 남은 시간만큼 종료 시간이 연장됩니다.',
                '강제 종료 시 즉시 당첨자가 결정됩니다.'
            ]
        }
    ];
</script>

<Card>
    <CardHeader class="pb-0">
        <button
            class="flex w-full items-center justify-between text-left"
            onclick={() => (isOpen = !isOpen)}
        >
            <CardTitle class="flex items-center gap-2 text-base">
                <BookOpen class="h-4 w-4" />
                나눔 규칙 안내
            </CardTitle>
            <ChevronDown
                class="text-muted-foreground h-4 w-4 transition-transform {isOpen
                    ? 'rotate-180'
                    : ''}"
            />
        </button>
    </CardHeader>

    {#if isOpen}
        <CardContent class="pt-4">
            <div class="space-y-4">
                {#each rules as section, idx}
                    <div>
                        <h4 class="text-foreground mb-2 text-sm font-semibold">
                            {idx + 1}. {section.title}
                        </h4>
                        <ul class="space-y-1">
                            {#each section.items as item}
                                <li
                                    class="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
                                >
                                    <span
                                        class="bg-muted-foreground/50 mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                                    ></span>
                                    {item}
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </div>
        </CardContent>
    {/if}
</Card>
