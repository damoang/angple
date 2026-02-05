import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isInstalled, updateSettings } from '$lib/server/install/check-installed';
import { scanThemes, getThemePath } from '$lib/server/themes/scanner';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * 설치 위저드 Step 1 서버 로직
 */

export const load: PageServerLoad = async () => {
    // 이미 설치 완료된 경우 홈으로 리다이렉트
    if (isInstalled()) {
        throw redirect(302, '/');
    }

    // 설치 가능한 테마 목록 로드
    const themesMap = scanThemes();
    const themes = Array.from(themesMap.values()).map((theme) => {
        // 스크린샷 파일 실제 존재 여부 확인
        let screenshotPath: string | null = null;
        if (theme.screenshot) {
            const themePath = getThemePath(theme.id);
            const fullScreenshotPath = join(themePath, theme.screenshot);
            if (existsSync(fullScreenshotPath)) {
                screenshotPath = theme.screenshot;
            }
        }

        return {
            id: theme.id,
            name: theme.name,
            description: theme.description || '',
            screenshot: screenshotPath
        };
    });

    // damoang-default를 첫 번째로 정렬
    themes.sort((a, b) => {
        if (a.id === 'damoang-default') return -1;
        if (b.id === 'damoang-default') return 1;
        return a.name.localeCompare(b.name);
    });

    return { themes };
};

export const actions: Actions = {
    default: async ({ request }) => {
        console.log('[Install Step 1] Form submitted');
        const formData = await request.formData();

        const siteName = formData.get('siteName') as string;
        const siteDescription = formData.get('siteDescription') as string;
        const siteUrl = formData.get('siteUrl') as string;
        const language = formData.get('language') as string;
        const activeTheme = formData.get('activeTheme') as string;

        console.log(
            '[Install Step 1] siteName:',
            siteName,
            'language:',
            language,
            'activeTheme:',
            activeTheme
        );

        if (!siteName || siteName.trim() === '') {
            console.log('[Install Step 1] Validation failed: siteName empty');
            return {
                success: false,
                error: '사이트 이름은 필수입니다.'
            };
        }

        // 설정 저장 (Step 1 데이터)
        console.log('[Install Step 1] Saving settings...');
        const updated = updateSettings({
            siteName: siteName.trim(),
            siteDescription: siteDescription?.trim() || '',
            siteUrl: siteUrl?.trim() || '',
            language: language || 'ko',
            activeTheme: activeTheme || 'damoang-default'
        });

        if (!updated) {
            console.log('[Install Step 1] updateSettings failed');
            return {
                success: false,
                error: '설정 저장에 실패했습니다.'
            };
        }

        console.log('[Install Step 1] Settings saved, redirecting to step-2');
        // Step 2로 이동
        throw redirect(302, '/install/step-2');
    }
};
