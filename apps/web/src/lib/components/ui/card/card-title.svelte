<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn, type WithElementRef } from '$lib/utils.js';

    // `tag` 로 시맨틱 요소를 고를 수 있다. 기본값은 종전과 같은 `div` 라
    // 기존 63개 사용처의 동작은 그대로다. 글 상세처럼 이 제목이 그 페이지의
    // 주제목인 곳에서만 `tag="h1"` 로 올려 헤딩 계층을 만든다.
    let {
        ref = $bindable(null),
        class: className,
        tag = 'div',
        children,
        ...restProps
    }: WithElementRef<HTMLAttributes<HTMLDivElement>> & { tag?: string } = $props();
</script>

<svelte:element
    this={tag}
    bind:this={ref}
    data-slot="card-title"
    class={cn('font-semibold leading-none', className)}
    {...restProps}
>
    {@render children?.()}
</svelte:element>
