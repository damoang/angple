import type { PluginWithStatus, PluginAction } from '$lib/types';
import { toast } from 'svelte-sonner';
import * as pluginsApi from '$lib/api/plugins';

/**
 * 플러그인 관리 Store (Svelte 5 Rune 모드)
 *
 * Web API를 통해 실제 파일 시스템에서 플러그인을 로드하고 관리합니다.
 * 테마 스토어(theme-store.svelte.ts)와 동일한 패턴으로 구현되었습니다.
 */
class PluginStore {
    /** 플러그인 목록 */
    plugins = $state<PluginWithStatus[]>([]);

    /** 로딩 상태 */
    isLoading = $state(false);

    /** 현재 진행 중인 액션 */
    currentAction = $state<{ pluginId: string; action: PluginAction } | null>(null);

    /**
     * Web API에서 플러그인 목록 로드
     */
    async loadPlugins() {
        this.isLoading = true;
        try {
            this.plugins = await pluginsApi.getPlugins();
            console.log(`✅ ${this.plugins.length}개 플러그인 로드됨`);
        } catch (error) {
            console.error('❌ 플러그인 목록 로드 실패:', error);
            toast.error('플러그인 목록을 불러오지 못했습니다. Web 앱이 실행 중인지 확인하세요.');
            this.plugins = [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 활성화된 플러그인 목록 가져오기
     */
    get activePlugins() {
        return this.plugins.filter((plugin) => plugin.status === 'active');
    }

    /**
     * 플러그인 ID로 찾기
     */
    getPluginById(pluginId: string): PluginWithStatus | undefined {
        return this.plugins.find((plugin) => plugin.manifest.id === pluginId);
    }

    /**
     * 플러그인 활성화
     */
    async activatePlugin(pluginId: string) {
        this.isLoading = true;
        this.currentAction = { pluginId, action: 'activate' };

        try {
            // Web API 호출 → plugin-settings.json 업데이트
            await pluginsApi.activatePlugin(pluginId);

            // 로컬 상태 동기화
            const plugin = this.getPluginById(pluginId);
            if (plugin) {
                plugin.status = 'active';
                plugin.activatedAt = new Date();

                // Cookie에 플러그인 변경 플래그 기록 (Web 앱 감지용)
                try {
                    const timestamp = Date.now();
                    document.cookie = `plugin-reload-trigger=${pluginId}:${timestamp}; path=/; max-age=60`;
                    console.log('🔄 플러그인 변경 플래그 설정:', pluginId, timestamp);
                } catch (e) {
                    console.warn('Cookie 저장 실패:', e);
                }

                toast.success(`${plugin.manifest.name} 플러그인이 활성화되었습니다.`, {
                    description: 'Web 앱을 새로고침하거나 탭을 전환하면 적용됩니다.',
                    action: {
                        label: 'Web 앱 열기',
                        onClick: () => window.open('http://localhost:5173', '_blank')
                    }
                });
            }
        } catch (error) {
            console.error('플러그인 활성화 실패:', error);
            toast.error('플러그인 활성화에 실패했습니다. Web 앱이 실행 중인지 확인하세요.');
        } finally {
            this.isLoading = false;
            this.currentAction = null;
        }
    }

    /**
     * 플러그인 비활성화
     */
    async deactivatePlugin(pluginId: string) {
        this.isLoading = true;
        this.currentAction = { pluginId, action: 'deactivate' };

        try {
            // Web API 호출
            await pluginsApi.deactivatePlugin(pluginId);

            const plugin = this.getPluginById(pluginId);
            if (plugin) {
                plugin.status = 'inactive';
                plugin.activatedAt = undefined;

                // Cookie에 플러그인 변경 플래그 기록 (Web 앱 감지용)
                try {
                    const timestamp = Date.now();
                    document.cookie = `plugin-reload-trigger=${pluginId}:${timestamp}; path=/; max-age=60`;
                } catch (e) {
                    console.warn('Cookie 저장 실패:', e);
                }

                toast.success(`${plugin.manifest.name} 플러그인이 비활성화되었습니다.`);
            }
        } catch (error) {
            console.error('플러그인 비활성화 실패:', error);
            toast.error('플러그인 비활성화에 실패했습니다.');
        } finally {
            this.isLoading = false;
            this.currentAction = null;
        }
    }

    /**
     * 플러그인 삭제 (커스텀 플러그인만)
     */
    async deletePlugin(pluginId: string) {
        this.isLoading = true;
        this.currentAction = { pluginId, action: 'delete' };

        try {
            await pluginsApi.deletePlugin(pluginId);

            const index = this.plugins.findIndex((plugin) => plugin.manifest.id === pluginId);
            if (index !== -1) {
                const pluginName = this.plugins[index].manifest.name;
                this.plugins.splice(index, 1);
                toast.success(`${pluginName} 플러그인이 삭제되었습니다.`);
            }
        } catch (error) {
            console.error('플러그인 삭제 실패:', error);
            const errorMessage =
                error instanceof Error ? error.message : '플러그인 삭제에 실패했습니다.';
            toast.error(errorMessage);
        } finally {
            this.isLoading = false;
            this.currentAction = null;
        }
    }

    /**
     * 특정 액션이 진행 중인지 확인
     */
    isActionInProgress(pluginId: string, action: PluginAction): boolean {
        return (
            this.currentAction !== null &&
            this.currentAction.pluginId === pluginId &&
            this.currentAction.action === action
        );
    }

    /**
     * 플러그인이 로딩 중인지 확인
     */
    isPluginLoading(pluginId: string): boolean {
        return this.currentAction !== null && this.currentAction.pluginId === pluginId;
    }
}

/**
 * 전역 플러그인 Store 인스턴스
 */
export const pluginStore = new PluginStore();
