<script lang="ts">
    /**
     * 위키 브레드크럼 — path 계층 분해.
     * 예: "이재명_정부/2025년_6월" → 위키앙 / 이재명 정부 / 2025년 6월
     * 링크는 루트 URL (reroute 로 /문서 serving).
     */
    import HomeIcon from '@lucide/svelte/icons/home';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

    let { path }: { path: string } = $props();

    type Crumb = { label: string; href: string; current: boolean };

    const crumbs = $derived.by<Crumb[]>(() => {
        const clean = (path || '').replace(/^\/+/, '').replace(/\/+$/, '');
        if (!clean) return [];
        const parts = clean.split('/');
        const out: Crumb[] = [];
        let acc = '';
        parts.forEach((p, i) => {
            acc += '/' + encodeURIComponent(p);
            out.push({
                label: decodeURIComponent(p).replace(/_/g, ' '),
                href: acc,
                current: i === parts.length - 1
            });
        });
        return out;
    });
</script>

<nav class="wiki-breadcrumbs" aria-label="경로">
    <a href="/" class="crumb home" title="위키앙 대문">
        <HomeIcon class="h-3.5 w-3.5" />
    </a>
    {#each crumbs as c (c.href)}
        <ChevronRight class="sep h-3.5 w-3.5" />
        {#if c.current}
            <span class="crumb current">{c.label}</span>
        {:else}
            <a href={c.href} class="crumb">{c.label}</a>
        {/if}
    {/each}
</nav>

<style>
    .wiki-breadcrumbs {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.25rem;
        font-size: 0.8rem;
        color: var(--muted-foreground, #6b7280);
        margin-bottom: 0.75rem;
    }
    .crumb {
        color: var(--muted-foreground, #6b7280);
        text-decoration: none;
    }
    a.crumb:hover {
        color: var(--primary, #3366cc);
        text-decoration: underline;
    }
    .crumb.current {
        color: var(--foreground, #111827);
        font-weight: 600;
    }
    .sep {
        opacity: 0.5;
        flex-shrink: 0;
    }
</style>
