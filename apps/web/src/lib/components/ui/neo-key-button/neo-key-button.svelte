<script lang="ts">
    import { cn } from '$lib/utils';
    import type { HTMLButtonAttributes } from 'svelte/elements';

    type Size = 'sm' | 'md' | 'lg';

    interface Props extends HTMLButtonAttributes {
        size?: Size;
        liked?: boolean;
        pressed?: boolean; // 애니메이션 트리거용
        class?: string;
    }

    let {
        size = 'md',
        liked = $bindable(false),
        pressed = $bindable(false),
        disabled = undefined,
        class: className = '',
        onclick,
        ...restProps
    }: Props = $props();

    const sizes = {
        sm: { button: 'w-12 h-12 text-xl', radius: '6px', translate: '8px' },
        md: { button: 'w-14 h-14 text-2xl', radius: '7px', translate: '10px' },
        lg: { button: 'w-16 h-16 text-3xl', radius: '8px', translate: '12px' }
    };

    const currentSize = sizes[size];

    function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
        if (!disabled) {
            liked = !liked;
            pressed = true;

            // 애니메이션 후 pressed 상태 초기화
            setTimeout(() => {
                pressed = false;
            }, 200);

            // 사용자 정의 onclick 핸들러 실행
            onclick?.(event);
        }
    }

    let showTooltip = $state(false);
</script>

<div class={cn('flex', className)}>
    <div style="transform: translateY(-{currentSize.translate})">
        <button
            type="button"
            class={cn(
                'btn-3d',
                currentSize.button,
                'flex items-center justify-center',
                disabled ? 'cursor-not-allowed opacity-50' : ''
            )}
            style="--btn-radius: {currentSize.radius}; --btn-translate: {currentSize.translate};"
            onclick={handleClick}
            {disabled}
            onmouseenter={() => (showTooltip = true)}
            onmouseleave={() => (showTooltip = false)}
            {...restProps}
        >
            <span class="btn-icon {pressed ? 'active' : ''}">
                <slot />
            </span>
            <span class="sr-only">
                <slot name="label">{liked ? '좋아요!' : '좋아요'}</slot>
            </span>
        </button>

        {#if showTooltip && !disabled}
            <div class="tooltip">
                <slot name="tooltip">{liked ? '좋아요!' : '좋아요'}</slot>
            </div>
        {/if}
    </div>
</div>

<style>
    /* 3D Button Base Styles */
    .btn-3d {
        border-radius: var(--btn-radius);
        background-color: var(--color-background);
        border: 1px solid var(--color-border);
        transform-style: preserve-3d;
        position: relative;
        z-index: 2;
        transition:
            transform 150ms cubic-bezier(0, 0, 0.58, 1),
            background-color 150ms cubic-bezier(0, 0, 0.58, 1);
    }

    .btn-3d::before {
        position: absolute;
        content: '';
        inset: 0;
        background-color: var(--color-subtle);
        border-radius: calc(var(--btn-radius) - 1px);
        box-shadow:
            0 0 0 1px var(--color-border),
            0 8px 6px 1px rgba(0, 0, 0, 0.15);
        transform: translate3d(0, var(--btn-translate), -12px);
        transition:
            transform 150ms cubic-bezier(0, 0, 0.58, 1),
            box-shadow 150ms cubic-bezier(0, 0, 0.58, 1);
    }

    .btn-3d:hover:not(:disabled) {
        background-color: var(--color-canvas);
        transform: translate(0, calc(var(--btn-translate) * 0.4));
    }

    .btn-3d:hover:not(:disabled)::before {
        box-shadow:
            0 0 0 1px var(--color-canvas),
            0 6px 4px 1px rgba(0, 0, 0, 0.15);
        transform: translate3d(0, calc(var(--btn-translate) * 0.6), -12px);
    }

    .btn-3d:active:not(:disabled) {
        background-color: var(--color-subtle);
        transform: translate(0, var(--btn-translate));
    }

    .btn-3d:active:not(:disabled)::before {
        box-shadow: none;
        transform: translate3d(0, 0px, -12px);
    }

    /* Icon Animation */
    .btn-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
            color 0.3s ease,
            transform 0.2s ease;
    }

    .btn-icon.active {
        transform: scale(1.1);
    }

    /* slot 내부 아이콘에 대한 스타일 */
    .btn-icon :global(svg) {
        width: 1em;
        height: 1em;
        stroke: currentColor;
    }

    /* Tooltip */
    .tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        padding: 4px 8px;
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        font-size: 12px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        animation: fadeIn 0.2s ease-in forwards;
    }

    .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.9);
    }

    @keyframes fadeIn {
        to {
            opacity: 1;
        }
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
        .btn-3d {
            --tw-bg-primary: #1f2937;
            --tw-bg-secondary: #111827;
            --tw-bg-tertiary: #374151;
            --tw-border-primary: #374151;
        }
    }

    /* Screen reader only */
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    }
</style>
