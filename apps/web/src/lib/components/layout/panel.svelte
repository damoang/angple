<script lang="ts">
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import { SidebarWidgetRenderer } from '$lib/components/features/sidebar-widgets';
</script>

<div class="flex flex-col gap-4 p-4">
    <!-- Slot: sidebar-right-top -->
    {#each getComponentsForSlot('sidebar-right-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- 동적 사이드바 위젯 렌더러 -->
    <SidebarWidgetRenderer />

    <!-- Slot: sidebar-right-bottom -->
    {#each getComponentsForSlot('sidebar-right-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}
</div>
