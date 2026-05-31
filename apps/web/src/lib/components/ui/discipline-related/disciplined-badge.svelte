<script lang="ts">
    import Scale from '@lucide/svelte/icons/scale';

    interface Props {
        class?: string;
    }
    let { class: className = '' }: Props = $props();
</script>

<span
    class="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0 align-middle text-[10px] text-amber-700 dark:text-amber-400 {className}"
    title="이용제한 처분 근거 글/댓글"
>
    <Scale class="h-2.5 w-2.5" />
    이용제한 처분
</span>
