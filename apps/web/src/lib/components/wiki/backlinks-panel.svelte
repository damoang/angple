<script lang="ts">
    import LinkIcon from '@lucide/svelte/icons/link-2';

    interface Backlink {
        id: number;
        path: string;
        title: string;
        description?: string | null;
    }

    interface Props {
        backlinks: Backlink[];
    }

    const { backlinks }: Props = $props();

    function href(p: string): string {
        const trimmed = p.replace(/^\/+/, '').replace(/\/+$/, '');
        if (!trimmed) return '/';
        return '/' + trimmed.split('/').map(encodeURIComponent).join('/');
    }
</script>

{#if backlinks.length > 0}
    <section class="backlinks">
        <h2 class="backlinks-title">
            <LinkIcon class="h-4 w-4" /> 여기를 가리키는 문서 ({backlinks.length})
        </h2>
        <ul class="backlinks-list">
            {#each backlinks as bl (bl.id)}
                <li>
                    <a href={href(bl.path)} class="backlinks-link" title={bl.path}>
                        {bl.title}
                    </a>
                </li>
            {/each}
        </ul>
    </section>
{/if}

<style>
    .backlinks {
        margin-top: 2.5rem;
        border-top: 1px solid var(--border, #e5e7eb);
        padding-top: 1.25rem;
    }
    .backlinks-title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.95rem;
        font-weight: 600;
        margin: 0 0 0.75rem;
        color: var(--muted-foreground, #6b7280);
    }
    .backlinks-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.35rem 1rem;
    }
    .backlinks-list li {
        font-size: 0.85rem;
        line-height: 1.4;
    }
    .backlinks-link {
        color: var(--primary, #3366cc);
        text-decoration: none;
    }
    .backlinks-link:hover {
        text-decoration: underline;
    }
</style>
