<script lang="ts">
    /** 필드 경로 하나의 오류 메시지(백엔드 400 details 또는 화면 검사). 없으면 아무것도 그리지 않는다. */
    let { errors, path }: { errors: Record<string, string[]>; path: string } = $props();

    const messages = $derived(errors[path] ?? []);
</script>

{#if messages.length > 0}
    <p class="text-destructive mt-1 text-xs" role="alert">{messages.join(' / ')}</p>
{/if}
