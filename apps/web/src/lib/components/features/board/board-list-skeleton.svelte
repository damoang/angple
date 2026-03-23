<script lang="ts">
    import Loader2 from '@lucide/svelte/icons/loader-2';
</script>

<div
    class="border-border bg-background flex min-h-[320px] flex-col items-center justify-center rounded-xl border"
    aria-busy="true"
    aria-live="polite"
>
    <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
    <p class="text-muted-foreground mt-3 text-sm">게시글을 불러오는 중입니다.</p>
</div>
