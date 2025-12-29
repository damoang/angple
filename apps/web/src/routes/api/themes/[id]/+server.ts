/**
 * 테마 삭제 API
 *
 * DELETE /api/themes/:id
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { readSettings, removeThemeSettings } from '$lib/server/settings';

// 테마 디렉터리 경로
const THEMES_DIR = path.join(process.cwd(), 'themes');

/**
 * 테마 삭제
 */
export const DELETE: RequestHandler = async ({ params }) => {
    const { id: themeId } = params;

    if (!themeId) {
        return json({ error: '테마 ID가 제공되지 않았습니다.' }, { status: 400 });
    }

    try {
        // 1. 활성 테마 확인
        const settings = await readSettings();

        if (settings.activeTheme === themeId) {
            return json(
                {
                    error: '활성화된 테마는 삭제할 수 없습니다.',
                    message: '다른 테마를 활성화한 후 삭제해주세요.'
                },
                { status: 403 }
            );
        }

        // 2. 테마 디렉터리 존재 여부 확인
        const themePath = path.join(THEMES_DIR, themeId);

        if (!existsSync(themePath)) {
            return json(
                {
                    error: '테마를 찾을 수 없습니다.',
                    themeId
                },
                { status: 404 }
            );
        }

        console.log(`🗑️ [Theme Delete] 테마 삭제 시작: ${themeId}`);

        // 3. 테마 디렉터리 삭제
        await rm(themePath, { recursive: true, force: true });
        console.log(`✅ [Theme Delete] 디렉터리 삭제 완료: ${themePath}`);

        // 4. 설정 파일에서 테마 정보 제거
        await removeThemeSettings(themeId);

        return json({
            success: true,
            message: '테마가 성공적으로 삭제되었습니다.',
            themeId
        });
    } catch (error) {
        console.error('❌ [Theme Delete] 삭제 실패:', error);

        return json(
            {
                error: '테마 삭제 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
