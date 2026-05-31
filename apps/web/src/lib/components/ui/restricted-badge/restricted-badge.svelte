<script lang="ts">
    import Lock from '@lucide/svelte/icons/lock';

    interface Props {
        class?: string;
    }
    let { class: className = '' }: Props = $props();
</script>

<span
    class="text-destructive bg-destructive/10 inline-flex items-center gap-0.5 rounded px-1 py-0 align-middle text-[10px] {className}"
    title="이용제한 글/댓글"
>
    <Lock class="h-2.5 w-2.5" />
    이용제한
</span>
