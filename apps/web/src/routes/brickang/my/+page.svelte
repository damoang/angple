<script lang="ts">
    import MyBricks from '../../../../../../plugins/brickang/components/MyBricks.svelte';
    import type { PageData } from './$types.js';

    interface Props {
        data: PageData;
    }
    let { data }: Props = $props();
</script>

<svelte:head>
    <title>내 벽돌 — 브릭앙</title>
</svelte:head>

<MyBricks userId={data.userId} />
