/**
 * 플러그인 관리 Store (Svelte 5 Rune 모드)
 */

import type { PluginWithStatus, PluginAction } from '$lib/types/admin-plugin';
import { toast } from 'svelte-sonner';
import * as pluginsApi from '$lib/api/admin-plugins';

class PluginStore {
    plugins = $state<PluginWithStatus[]>([]);
    isLoading = $state(false);
    currentAction = $state<{ pluginId: string; action: PluginAction } | null>(null);

    async loadPlugins() {
        this.isLoading = true;
        try {
            this.plugins = await pluginsApi.getPlugins();
        } catch (error) {
            console.error('❌ 플러그인 목록 로드 실패:', error);
            toast.error('플러그인 목록을 불러오지 못했습니다.');
            this.plugins = [];
        } finally {
            this.isLoading = false;
        }
    }

    get activePlugins() {
        return this.plugins.filter((plugin) => plugin.status === 'active');
    }

    getPluginById(pluginId: string): PluginWithStatus | undefined {
        return this.plugins.find((plugin) => plugin.manifest.id === pluginId);
    }

    async activatePlugin(pluginId: string) {
        this.isLoading = true;
        this.currentAction = { pluginId, action: 'activate' };
        try {
            await pluginsApi.activatePlugin(pluginId);
            const plugin = this.getPluginById(pluginId);
            if (plugin) {
                plugin.status = 'active';
                plugin.activatedAt = new Date();
                toast.success(`${plugin.manifest.name} 플러그인이 활성화되었습니다.`);
            }
        } catch (error) {
            console.error('플러그인 활성화 실패:', error);
            toast.error('플러그인 활성화에 실패했습니다.');
        } finally {
            this.isLoading = false;
            this.currentAction = null;
        }
    }

    async deactivatePlugin(pluginId: string) {
        this.isLoading = true;
        this.currentAction = { pluginId, action: 'deactivate' };
        try {
            await pluginsApi.deactivatePlugin(pluginId);
            const plugin = this.getPluginById(pluginId);
            if (plugin) {
                plugin.status = 'inactive';
                plugin.activatedAt = undefined;
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

    isActionInProgress(pluginId: string, action: PluginAction): boolean {
        return (
            this.currentAction !== null &&
            this.currentAction.pluginId === pluginId &&
            this.currentAction.action === action
        );
    }

    isPluginLoading(pluginId: string): boolean {
        return this.currentAction !== null && this.currentAction.pluginId === pluginId;
    }
}

export const pluginStore = new PluginStore();
