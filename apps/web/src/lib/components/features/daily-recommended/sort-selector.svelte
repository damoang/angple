<script lang="ts">
    interface Props {
        sortBy: 'recommend' | 'views' | 'comments' | 'latest';
    }

    let { sortBy = $bindable() }: Props = $props();

    const options: { value: Props['sortBy']; label: string }[] = [
        { value: 'recommend', label: '추천순' },
        { value: 'views', label: '조회순' },
        { value: 'comments', label: '댓글순' },
        { value: 'latest', label: '최신순' }
    ];
</script>

<select
    class="bg-background text-foreground rounded-md border px-2 py-1 text-xs"
    bind:value={sortBy}
>
    {#each options as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
    {/each}
</select>
