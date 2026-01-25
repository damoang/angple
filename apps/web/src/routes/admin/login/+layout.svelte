<script lang="ts">
    /**
     * 로그인 페이지는 admin 레이아웃(사이드바) 없이 독립적으로 표시
     */
    import type { Snippet } from 'svelte';

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
</script>

<!-- 부모 레이아웃 무시, 독립적인 전체 화면 -->
{@render children()}
