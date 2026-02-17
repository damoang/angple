/**
 * Web 앱 테마 관리 스토어
 *
 * Admin에서 설정한 테마를 적용합니다.
 */

export interface ThemeSettings {
    activeTheme: string | null;
    settings: Record<string, Record<string, unknown>>;
}

class ThemeStore {
    currentTheme = $state<ThemeSettings>({
        activeTheme: null,
        settings: {}
    });

    isLoading = $state(false);
    error = $state<string | null>(null);

    /**
     * SSR 데이터로 테마 초기화 (깜박임 방지)
     */
    initFromServer(activeTheme: string | null) {
        this.currentTheme = {
            activeTheme,
            settings: {}
        };

        // CSS 변수 적용
        this.applyThemeStyles();
    }

    /**
     * 활성화된 테마 로드
     */
    async loadActiveTheme() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.error = null;

        try {
            const response = await fetch('/api/themes/active');

            if (!response.ok) {
                this.currentTheme = { activeTheme: null, settings: {} };
                return;
            }

            const data = await response.json();
            this.currentTheme = {
                activeTheme: data.activeTheme,
                settings: data.themes?.[data.activeTheme]?.settings || {}
            };

            // CSS 변수 적용
            this.applyThemeStyles();
        } catch (err) {
            this.error = err instanceof Error ? err.message : '테마 로드 실패';
            console.error('테마 로드 에러:', err);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 테마 스타일 적용
     */
    private applyThemeStyles() {
        if (typeof document === 'undefined') return;

        const { settings } = this.currentTheme;

        // appearance.primaryColor 또는 colors.primary 적용
        const primaryColor = settings.appearance?.primaryColor || settings.colors?.primary;
        if (primaryColor && typeof primaryColor === 'string') {
            document.documentElement.style.setProperty('--theme-primary', primaryColor);
        }

        // secondary color 적용
        const secondaryColor = settings.appearance?.secondaryColor || settings.colors?.secondary;
        if (secondaryColor && typeof secondaryColor === 'string') {
            document.documentElement.style.setProperty('--theme-secondary', secondaryColor);
        }
    }

    /**
     * 특정 설정값 가져오기
     */
    getSetting(category: string, key: string): unknown {
        return this.currentTheme.settings[category]?.[key];
    }

    /**
     * showBanner 설정값
     */
    get showBanner(): boolean {
        return (this.getSetting('appearance', 'showBanner') as boolean) ?? true;
    }

    /**
     * primaryColor 설정값
     */
    get primaryColor(): string {
        return (this.getSetting('appearance', 'primaryColor') as string) ?? '#3b82f6';
    }
}

export const themeStore = new ThemeStore();
