<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import X from '@lucide/svelte/icons/x';

    interface Props {
        tags?: string[];
        onchange?: (tags: string[]) => void;
        maxTags?: number;
        disabled?: boolean;
    }

    let { tags = [], onchange, maxTags = 10, disabled = false }: Props = $props();

    let inputValue = $state('');
    let inputEl = $state<HTMLInputElement | null>(null);

    function addTag(value: string): void {
        const trimmed = value
            .trim()
            .replace(/^#/, '')
            .replace(/[<>"'&]/g, '');
        if (!trimmed || trimmed.length > 30) return;
        if (tags.includes(trimmed)) return;
        if (tags.length >= maxTags) return;

        const newTags = [...tags, trimmed];
        tags = newTags;
        onchange?.(newTags);
        inputValue = '';
    }

    function removeTag(index: number): void {
        const newTags = tags.filter((_, i) => i !== index);
        tags = newTags;
        onchange?.(newTags);
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    }

    function handleBlur(): void {
        if (inputValue.trim()) {
            addTag(inputValue);
        }
    }
</script>

<div
    class="border-input bg-background focus-within:ring-ring flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 focus-within:ring-2"
    onclick={() => inputEl?.focus()}
    role="textbox"
    tabindex="-1"
>
    {#each tags as tag, i (tag)}
        <Badge variant="secondary" class="gap-1 py-0.5">
            {tag}
            {#if !disabled}
                <button
                    type="button"
                    onclick={() => removeTag(i)}
                    class="hover:bg-muted-foreground/20 ml-0.5 rounded"
                >
                    <X class="h-3 w-3" />
                </button>
            {/if}
        </Badge>
    {/each}

    {#if !disabled && tags.length < maxTags}
        <input
            bind:this={inputEl}
            bind:value={inputValue}
            type="text"
            placeholder={tags.length === 0 ? '태그 입력 (쉼표 또는 엔터로 구분)' : ''}
            class="text-foreground placeholder:text-muted-foreground min-w-[120px] flex-1 border-none bg-transparent text-sm outline-none"
            onkeydown={handleKeydown}
            onblur={handleBlur}
            {disabled}
        />
    {/if}
</div>
{#if tags.length > 0}
    <p class="text-muted-foreground mt-1 text-xs">{tags.length}/{maxTags}개 태그</p>
{/if}
