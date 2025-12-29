/**
 * 테마 목록 조회 API
 *
 * GET /api/themes
 * 파일 시스템에서 스캔한 실제 테마 목록을 반환합니다.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstalledThemes } from '$lib/server/themes';
import type { ThemeManifest } from '$lib/types/theme';

/**
 * ThemeWithStatus 타입 (Admin과 호환)
 */
interface ThemeWithStatus {
    /** 테마 매니페스트 */
    manifest: ThemeManifest;

    /** 현재 상태 */
    status: 'active' | 'inactive' | 'installing' | 'error';

    /** 설치 날짜 */
    installedAt: Date;

    /** 마지막 업데이트 날짜 */
    updatedAt?: Date;

    /** 활성화 날짜 (활성화된 경우) */
    activatedAt?: Date;

    /** 현재 적용된 설정값 */
    currentSettings?: Record<string, unknown>;

    /** 설치 소스 */
    source?: string;

    /** 다운로드/설치 횟수 */
    downloadCount?: number;

    /** 에러 메시지 */
    errorMessage?: string;
}

export const GET: RequestHandler = async () => {
    try {
        // 파일 시스템에서 설치된 테마 목록 조회
        const installedThemes = await getInstalledThemes();

        // ThemeWithStatus 형식으로 변환
        const themes: ThemeWithStatus[] = [];

        for (const theme of installedThemes.values()) {
            themes.push({
                manifest: theme.manifest,
                status: theme.isActive ? 'active' : 'inactive',
                installedAt: new Date(), // TODO: 실제 설치 날짜 추적
                currentSettings: theme.currentSettings,
                source: 'local' // TODO: 설치 소스 추적
            });
        }

        console.log(`✅ [API /themes] ${themes.length}개 테마 반환`);

        return json({
            themes,
            total: themes.length
        });
    } catch (error) {
        console.error('❌ [API /themes] 테마 목록 조회 실패:', error);

        // 에러 발생 시 빈 배열 반환
        return json(
            {
                themes: [],
                total: 0,
                error: '테마 목록을 불러오는 데 실패했습니다.'
            },
            { status: 500 }
        );
    }
};
