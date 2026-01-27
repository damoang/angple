/**
 * Web 앱 플러그인 관리 스토어
 *
 * 활성화된 플러그인을 관리하고 플러그인 로드/언로드를 처리합니다.
 * 테마 스토어(theme.svelte.ts)와 동일한 패턴으로 구현되었습니다.
 */

import type { PluginManifest, PluginHook, PluginComponent } from '$lib/types/plugin';

/**
 * 활성 플러그인 정보
 */
export interface ActivePlugin {
    id: string;
    name: string;
    version: string;
    hooks: PluginHook[];
    components: PluginComponent[];
    settings: Record<string, unknown>;
}

/**
 * 플러그인 스토어 상태
 */
export interface PluginState {
    /** 활성화된 플러그인 목록 */
    activePlugins: ActivePlugin[];
    /** 로딩 중 여부 */
    isLoading: boolean;
    /** 에러 메시지 */
    error: string | null;
}

class PluginStore {
    /** 플러그인 상태 */
    state = $state<PluginState>({
        activePlugins: [],
        isLoading: false,
        error: null
    });

    /**
     * SSR 데이터로 플러그인 초기화 (깜박임 방지)
     */
    initFromServer(activePlugins: ActivePlugin[]) {
        console.log('🔧 [Plugin Store] Initializing from SSR:', activePlugins.length, 'plugins');

        this.state = {
            activePlugins,
            isLoading: false,
            error: null
        };
    }

    /**
     * 활성화된 플러그인 로드
     */
    async loadActivePlugins() {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.state.error = null;

        try {
            const response = await fetch('/api/plugins/active');

            if (!response.ok) {
                console.log('활성화된 플러그인 없음');
                this.state.activePlugins = [];
                return;
            }

            const data = await response.json();
            this.state.activePlugins = data.plugins || [];

            console.log('✅ 플러그인 로드 완료:', this.state.activePlugins.length, '개');
        } catch (err) {
            this.state.error = err instanceof Error ? err.message : '플러그인 로드 실패';
            console.error('❌ 플러그인 로드 에러:', err);
        } finally {
            this.state.isLoading = false;
        }
    }

    /**
     * 특정 플러그인이 활성화되어 있는지 확인
     */
    isPluginActive(pluginId: string): boolean {
        return this.state.activePlugins.some((p) => p.id === pluginId);
    }

    /**
     * 활성화된 플러그인 ID 목록 가져오기
     */
    get activePluginIds(): string[] {
        return this.state.activePlugins.map((p) => p.id);
    }

    /**
     * 특정 플러그인 정보 가져오기
     */
    getPlugin(pluginId: string): ActivePlugin | undefined {
        return this.state.activePlugins.find((p) => p.id === pluginId);
    }

    /**
     * 특정 플러그인 설정 가져오기
     */
    getPluginSettings(pluginId: string): Record<string, unknown> {
        const plugin = this.getPlugin(pluginId);
        return plugin?.settings || {};
    }

    /**
     * 모든 활성 플러그인의 Hook 가져오기
     */
    get allHooks(): Array<PluginHook & { pluginId: string }> {
        const hooks: Array<PluginHook & { pluginId: string }> = [];
        for (const plugin of this.state.activePlugins) {
            for (const hook of plugin.hooks) {
                hooks.push({ ...hook, pluginId: plugin.id });
            }
        }
        return hooks;
    }

    /**
     * 모든 활성 플러그인의 컴포넌트 가져오기
     */
    get allComponents(): Array<PluginComponent & { pluginId: string }> {
        const components: Array<PluginComponent & { pluginId: string }> = [];
        for (const plugin of this.state.activePlugins) {
            for (const component of plugin.components) {
                components.push({ ...component, pluginId: plugin.id });
            }
        }
        return components;
    }
}

/**
 * 전역 플러그인 스토어 인스턴스
 */
export const pluginStore = new PluginStore();
