<script lang="ts">
    import { onMount } from 'svelte';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import { EditModeToggle } from '$lib/components/features/widget-editor';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { apiClient } from '$lib/api';
    import type { IndexWidgetsData } from '$lib/api/types';

    const { data } = $props();

    // SSR 데이터를 로컬 상태로 관리 (반응형 보장)
    let widgetsData = $state<IndexWidgetsData | null>(data.indexWidgets);

    // 스토어도 초기화 (다른 컴포넌트에서 사용할 수 있도록)
    indexWidgetsStore.initFromServer(data.indexWidgets);

    // 위젯 레이아웃 스토어 초기화 (메인 + 사이드바)
    widgetLayoutStore.initFromServer(data.widgetLayout, data.sidebarWidgetLayout);

    onMount(async () => {
        // SSR 데이터 없을 경우 클라이언트에서 fetch
        if (!widgetsData) {
            const fetchedData = await apiClient.getIndexWidgets();
            widgetsData = fetchedData;
            indexWidgetsStore.initFromServer(fetchedData);
        }
    });
</script>

<!-- 통합 위젯 렌더러로 메인 영역 렌더링 -->
<WidgetRenderer zone="main" />

<!-- 편집 모드 토글 버튼 -->
<EditModeToggle />
