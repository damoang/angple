<script lang="ts">
    import type { WidgetProps } from '$lib/types/widget-props';
    import { TagNav, type TagNavMenu } from '$lib/components/ui/tag-nav';

    let { config }: WidgetProps = $props();

    const menus = $derived((config.settings?.menus as TagNavMenu[] | undefined) ?? undefined);
</script>

<TagNav {menus} />
