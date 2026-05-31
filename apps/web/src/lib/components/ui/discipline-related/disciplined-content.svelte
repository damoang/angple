<script lang="ts">
    import Scale from '@lucide/svelte/icons/scale';
    import Eye from '@lucide/svelte/icons/eye';

    interface Props {
        children: import('svelte').Snippet;
        isComment?: boolean;
        class?: string;
    }
    let { children, isComment = false, class: className = '' }: Props = $props();

    let revealed = $state(false);
</script>

<div class="relative {className}">
    <div
        class={revealed
            ? ''
            : 'pointer-events-none select-none blur-md transition-[filter] duration-200'}
        aria-hidden={!revealed}
    >
        {@render children()}
    </div>
    {#if !revealed}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-amber-500/5 p-4 backdrop-blur-sm"
        >
            <div
                class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
            >
                <Scale class="h-3.5 w-3.5" />
                이용제한 근거 {isComment ? '댓글' : '글'}
            </div>
            <button
                type="button"
                onclick={() => (revealed = true)}
                class="bg-background inline-flex items-center gap-1 rounded border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
            >
                <Eye class="h-3.5 w-3.5" />
                보기
            </button>
        </div>
    {/if}
</div>
