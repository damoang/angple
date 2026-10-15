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
    <PostForm boardId="free" onSubmit={async () => {}} />
</div>
`
);
