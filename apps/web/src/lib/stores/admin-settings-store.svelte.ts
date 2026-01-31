import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '$lib/types/admin-settings.js';
import { toast } from 'svelte-sonner';

/**
 * Admin 사이트 설정 Store (Svelte 5 Rune 모드)
 */
class AdminSettingsStore {
    settings = $state<SiteSettings>(structuredClone(DEFAULT_SITE_SETTINGS));
    isLoading = $state(false);
    isSaving = $state(false);

    /** API에서 설정 로드 */
    async loadSettings(): Promise<void> {
        this.isLoading = true;
        try {
            const res = await fetch('/api/admin/settings');
            if (!res.ok) throw new Error('설정 로드 실패');
            this.settings = await res.json();
        } catch (error) {
            console.error('설정 로드 실패:', error);
            toast.error('설정을 불러오지 못했습니다.');
        } finally {
            this.isLoading = false;
        }
    }

    /** API에 설정 저장 */
    async saveSettings(): Promise<void> {
        this.isSaving = true;
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.settings)
            });
            if (!res.ok) throw new Error('설정 저장 실패');
            toast.success('설정이 저장되었습니다.');
        } catch (error) {
            console.error('설정 저장 실패:', error);
            toast.error('설정을 저장하지 못했습니다.');
        } finally {
            this.isSaving = false;
        }
    }
}

export const adminSettingsStore = new AdminSettingsStore();
