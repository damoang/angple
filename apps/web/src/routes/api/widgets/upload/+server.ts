/**
 * 위젯 업로드 API
 *
 * POST /api/widgets/upload
 * - FormData로 ZIP 파일 받기
 * - 파일 검증 (widget.json 필수)
 * - custom-widgets/ 폴더에 압축 해제
 * - 위젯 스캔 후 목록 갱신
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { safeValidateWidgetManifest } from '$lib/types/widget-manifest';
import { sanitizePath } from '$lib/server/path-utils';
import { scanWidgets, getCustomWidgetsDir } from '$lib/server/widgets';

/** 커스텀 위젯 디렉터리 */
const CUSTOM_WIDGETS_DIR = getCustomWidgetsDir();

/** 최대 파일 크기: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/widgets/upload
 *
 * 위젯 ZIP 파일 업로드 처리
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        // FormData 파싱
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return json({ success: false, error: '파일이 제공되지 않았습니다.' }, { status: 400 });
        }

        // 파일 크기 검증
        if (file.size > MAX_FILE_SIZE) {
            return json(
                {
                    success: false,
                    error: `파일 크기가 너무 큽니다. (최대: ${MAX_FILE_SIZE / 1024 / 1024}MB)`
                },
                { status: 400 }
            );
        }

        // MIME 타입 검증
        const validMimeTypes = [
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream'
        ];
        if (!validMimeTypes.includes(file.type)) {
            return json(
                { success: false, error: 'ZIP 파일만 업로드 가능합니다.' },
                { status: 400 }
            );
        }

        // custom-widgets 디렉터리 생성 (없으면)
        if (!existsSync(CUSTOM_WIDGETS_DIR)) {
            mkdirSync(CUSTOM_WIDGETS_DIR, { recursive: true });
        }

        // 임시 ZIP 파일 저장
        const buffer = Buffer.from(await file.arrayBuffer());
        const tempZipPath = join(CUSTOM_WIDGETS_DIR, `temp-${Date.now()}.zip`);
        writeFileSync(tempZipPath, buffer);

        try {
            // ZIP 압축 해제
            const zip = new AdmZip(tempZipPath);
            const zipEntries = zip.getEntries();

            // widget.json 파일 찾기
            let widgetJsonEntry: AdmZip.IZipEntry | null = null;
            let rootFolder = '';

            for (const entry of zipEntries) {
                if (entry.entryName.endsWith('widget.json')) {
                    widgetJsonEntry = entry;
                    // 루트 폴더 추출 (예: "my-widget/widget.json" → "my-widget")
                    const parts = entry.entryName.split('/');
                    if (parts.length > 1) {
                        rootFolder = parts[0];
                    }
                    break;
                }
            }

            if (!widgetJsonEntry) {
                rmSync(tempZipPath);
                return json(
                    { success: false, error: 'ZIP 파일에 widget.json이 없습니다.' },
                    { status: 400 }
                );
            }

            // widget.json 검증
            const widgetJsonContent = widgetJsonEntry.getData().toString('utf8');
            const widgetManifestData = JSON.parse(widgetJsonContent);
            const validationResult = safeValidateWidgetManifest(widgetManifestData);

            if (!validationResult.success) {
                rmSync(tempZipPath);
                return json(
                    {
                        success: false,
                        error: 'widget.json 형식이 올바르지 않습니다.',
                        details: validationResult.error.issues
                    },
                    { status: 400 }
                );
            }

            const widgetManifest = validationResult.data;
            const widgetId = sanitizePath(widgetManifest.id);

            // 위젯 ID와 폴더명 일치 검증
            if (rootFolder && rootFolder !== widgetId) {
                rmSync(tempZipPath);
                return json(
                    {
                        success: false,
                        error: `ZIP 루트 폴더명(${rootFolder})과 위젯 ID(${widgetId})가 일치하지 않습니다.`
                    },
                    { status: 400 }
                );
            }

            // 이미 존재하는 위젯 확인
            const targetDir = join(CUSTOM_WIDGETS_DIR, widgetId);
            if (existsSync(targetDir)) {
                rmSync(tempZipPath);
                return json(
                    { success: false, error: `위젯 "${widgetId}"가 이미 설치되어 있습니다.` },
                    { status: 409 }
                );
            }

            // ZIP 압축 해제
            // rootFolder가 있으면 해당 폴더만 추출, 없으면 전체 추출
            if (rootFolder) {
                // 예: "my-widget/" 폴더의 내용을 custom-widgets/my-widget/로 추출
                const tempExtractPath = join(CUSTOM_WIDGETS_DIR, `temp-extract-${Date.now()}`);
                zip.extractAllTo(tempExtractPath, true);

                // 임시 폴더의 rootFolder를 최종 위치로 이동
                const extractedWidgetDir = join(tempExtractPath, rootFolder);
                if (existsSync(extractedWidgetDir)) {
                    // Node.js의 fs.renameSync로 이동
                    const fs = await import('fs');
                    fs.renameSync(extractedWidgetDir, targetDir);
                    // 임시 폴더 삭제
                    rmSync(tempExtractPath, { recursive: true, force: true });
                } else {
                    rmSync(tempExtractPath, { recursive: true, force: true });
                    throw new Error('압축 해제된 위젯 폴더를 찾을 수 없습니다.');
                }
            } else {
                // rootFolder가 없으면 전체 파일을 targetDir에 직접 추출
                mkdirSync(targetDir, { recursive: true });
                zip.extractAllTo(targetDir, true);
            }

            // 임시 ZIP 파일 삭제
            rmSync(tempZipPath);

            // 위젯 재스캔
            scanWidgets();

            return json({
                success: true,
                message: `위젯 "${widgetManifest.name}"가 성공적으로 업로드되었습니다.`,
                widgetId,
                manifest: widgetManifest
            });
        } catch (error) {
            // 오류 발생 시 임시 파일 정리
            if (existsSync(tempZipPath)) {
                rmSync(tempZipPath);
            }

            console.error('[Widget Upload] 업로드 처리 중 오류:', error);
            return json(
                {
                    success: false,
                    error: '위젯 업로드 중 오류가 발생했습니다.',
                    details: error instanceof Error ? error.message : String(error)
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[Widget Upload] 요청 처리 중 오류:', error);
        return json(
            {
                success: false,
                error: '요청 처리 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
