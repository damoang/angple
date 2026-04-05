<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    interface TocItem {
        id: string;
        text: string;
        level: number;
    }

    interface Props {
        contentSelector?: string;
    }

    let { contentSelector = '.wiki-content' }: Props = $props();

    let tocItems = $state<TocItem[]>([]);
    let activeId = $state<string | null>(null);
    let observer: IntersectionObserver | null = null;

    function generateId(text: string, index: number): string {
        const slug = text
            .toLowerCase()
            .replace(/[^\w\s가-힣-]/g, '')
            .replace(/\s+/g, '-')
            .trim();
        return `heading-${slug || index}`;
    }

    function buildToc(): void {
        const contentEl = document.querySelector(contentSelector);
        if (!contentEl) return;

        const headings = contentEl.querySelectorAll('h1, h2, h3, h4');
        const items: TocItem[] = [];

        headings.forEach((heading, index) => {
            const el = heading as HTMLElement;
            // ID가 없으면 생성
            if (!el.id) {
                el.id = generateId(el.textContent || '', index);
            }
            items.push({
                id: el.id,
                text: el.textContent || '',
                level: parseInt(el.tagName[1], 10)
            });
        });

        tocItems = items;
    }

    function setupObserver(): void {
        if (observer) observer.disconnect();

        const options = {
            root: null,
            rootMargin: '-80px 0px -70% 0px',
            threshold: 0
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    activeId = entry.target.id;
                }
            });
        }, options);

        tocItems.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) observer?.observe(el);
        });
    }

    function scrollToHeading(id: string): void {
        const el = document.getElementById(id);
        if (el) {
            const offset = 100;
            const y = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }

    onMount(() => {
        // DOM이 완전히 로드된 후 TOC 빌드
        setTimeout(() => {
            buildToc();
            if (tocItems.length > 0) {
                setupObserver();
            }
        }, 100);
    });

    onDestroy(() => {
        if (observer) observer.disconnect();
    });

    function getIndentClass(level: number): string {
        switch (level) {
            case 1:
                return 'pl-0 font-semibold';
            case 2:
                return 'pl-3';
            case 3:
                return 'pl-6';
            case 4:
                return 'pl-9';
            default:
                return 'pl-0';
        }
    }
</script>

{#if tocItems.length > 0}
    <nav class="toc-nav border-border sticky top-20 hidden w-56 flex-shrink-0 xl:block">
        <div class="border-border border-l-2 pl-4">
            <h3 class="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                목차
            </h3>
            <ul class="space-y-1">
                {#each tocItems as item}
                    <li>
                        <button
                            type="button"
                            onclick={() => scrollToHeading(item.id)}
                            class="block w-full text-left text-sm leading-relaxed transition-colors {getIndentClass(
                                item.level
                            )} {activeId === item.id
                                ? 'text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground'}"
                        >
                            {item.text}
                        </button>
                    </li>
                {/each}
            </ul>
        </div>
    </nav>
{/if}

<style>
    .toc-nav {
        max-height: calc(100vh - 6rem);
        overflow-y: auto;
    }

    .toc-nav::-webkit-scrollbar {
        width: 4px;
    }

    .toc-nav::-webkit-scrollbar-track {
        background: transparent;
    }

    .toc-nav::-webkit-scrollbar-thumb {
        background-color: var(--border);
        border-radius: 2px;
    }
</style>
