// Build a real post-form fixture only in CI's disposable E2E application.
import { mkdir, writeFile } from 'node:fs/promises';

if (!process.env.CI) throw new Error('This fixture is CI-only');
const dir = new URL('../apps/web/src/routes/__qa/context-links/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(
    new URL('+page.svelte', dir),
    `<script lang="ts">
    import PostForm from '$lib/components/features/board/post-form.svelte';
</script>
<div class="mx-auto max-w-3xl p-3">
    <PostForm mode="create" boardId="free" onSubmit={async () => {}} />
</div>
`
);

const wikiDir = new URL('../apps/web/src/routes/__qa/wiki-links/', import.meta.url);
await mkdir(wikiDir, { recursive: true });
await writeFile(
    new URL('+page.svelte', wikiDir),
    `<script lang="ts">
    import { onMount } from 'svelte';
    import { enhanceWikiangLinks } from '$lib/utils/wikiang-link';
    let container: HTMLDivElement;
    onMount(() => { void enhanceWikiangLinks(container); });
</script>
<button onclick={() => enhanceWikiangLinks(container)}>다시 조회</button>
<div bind:this={container}>
    <p><a id="wiki0" href="https://ko.wikipedia.org/wiki/문서0">위키백과 문서</a></p>
    {#each Array.from({ length: 20 }, (_, i) => i + 1) as i}
        <p><a id={'wiki' + i} href={'https://namu.wiki/w/문서' + i}>나무위키 문서 {i}</a></p>
    {/each}
    <p><a id="forged" href="https://evilnamu.wiki/w/위조">위조 도메인</a></p>
</div>
`
);
