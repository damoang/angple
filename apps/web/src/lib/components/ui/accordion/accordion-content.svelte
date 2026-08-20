<script lang="ts">
    import { Accordion as AccordionPrimitive } from 'bits-ui';
    import { cn, type WithoutChild } from '$lib/utils.js';

    let {
        ref = $bindable(null),
        class: className,
        animated = true,
        children,
        ...restProps
    }: WithoutChild<AccordionPrimitive.ContentProps> & { animated?: boolean } = $props();
</script>

<!--
    animated={false} 로 열고닫기 애니메이션을 끌 수 있다.

    ⛔ **서버에서 열린 채로 렌더되는 아코디언은 애니메이션을 끄는 편이 낫다.**
    열림 애니메이션(accordion-down)은 height 0 → var(--bits-accordion-content-height) 로 가는데,
    이 변수는 bits-ui 가 **마운트 후 실측해야** 정해진다. 서버 HTML 에는 항상 `0px` 로 나간다.
    그래서 SSR 이 open 이면 (1) 0px 을 목표로 한 번 재생되고 (2) 마운트 후 변수가 실제 높이로
    바뀌며 다시 재생된다 — 밀림이 한 번이 아니라 **두 번** 난다.
    2026-08-20 카나리 실측: 데스크톱 CLS 0.045 → 0.111 로 오히려 악화.
    닫힌 컨텐츠는 bits-ui 가 `hidden` 속성으로 숨기므로(SSR 에서도 10/10 확인)
    애니메이션을 꺼도 닫힌 메뉴가 펼쳐지지 않는다.
-->
<AccordionPrimitive.Content
    bind:ref
    data-slot="accordion-content"
    class={animated
        ? 'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm'
        : 'overflow-hidden text-sm'}
    {...restProps}
>
    <div class={cn('pb-4 pt-0', className)}>
        {@render children?.()}
    </div>
</AccordionPrimitive.Content>
