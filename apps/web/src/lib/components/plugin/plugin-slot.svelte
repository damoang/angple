<script lang="ts">
    import { getComponentsForSlot, subscribeToSlotChanges, getSlotVersion } from '../slot-manager';
    import type { SlotName, SlotComponent } from '../slot-manager';
    import { onMount } from 'svelte';

    interface Props {
        /** 슬롯 이름 */
        name: SlotName;
        /** 슬롯에 전달할 추가 props */
        [key: string]: unknown;
    }

    let { name, ...extraProps }: Props = $props();

    let components = $state<SlotComponent[]>([]);
    let slotVersion = $state(0);
    let errors = $state<Map<string, string>>(new Map());

    // 슬롯 변경 감지 및 컴포넌트 목록 갱신
    function refreshComponents() {
        components = getComponentsForSlot(name);
        slotVersion = getSlotVersion();
    }

    onMount(() => {
        refreshComponents();
        const unsubscribe = subscribeToSlotChanges(() => {
            refreshComponents();
        });
        return unsubscribe;
    });

    // name 변경 시에도 갱신
    $effect(() => {
        // name 참조 → 리액티브 트래킹
        void name;
        refreshComponents();
    });

    /**
     * 컴포넌트 렌더링 에러 핸들링
     */
    function handleError(componentId: string, error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errors.set(componentId, message);
        console.error(`[PluginSlot:${name}] 컴포넌트 에러 (${componentId}):`, error);
    }
</script>

{#if components.length > 0}
    <div class="plugin-slot" data-slot={name}>
        {#each components as slot (slot.id)}
            {#if !errors.has(slot.id)}
                <div class="plugin-slot-item" data-plugin-source={slot.source || 'unknown'}>
                    {#key slot.id}
                        <slot.component {...(slot.props ?? {})} {...extraProps} />
                    {/key}
                </div>
            {:else}
                <!-- 에러 발생한 컴포넌트는 숨김 처리 (프로덕션) -->
                {#if import.meta.env.DEV}
                    <div class="plugin-slot-error rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                        [Plugin Error: {slot.source || slot.id}] {errors.get(slot.id)}
                    </div>
                {/if}
            {/if}
        {/each}
    </div>
{/if}
