/**
 * 플러그인 업로드 API
 *
 * POST /api/plugins/upload
 * - FormData로 ZIP 파일 받기
 * - 파일 검증 (plugin.json 또는 extension.json 필수)
 * - custom-plugins/ 폴더에 압축 해제
 * - 플러그인 스캔 후 목록 갱신
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { safeValidateExtensionManifest } from '@angple/types';
import { sanitizePath } from '$lib/server/path-utils';
import { scanPlugins } from '$lib/server/plugins/scanner';

/** 커스텀 플러그인 디렉터리 */
const CUSTOM_PLUGINS_DIR = join(process.cwd(), 'custom-plugins');

/** 최대 파일 크기: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/plugins/upload
 *
 * 플러그인 ZIP 파일 업로드 처리
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

		// custom-plugins 디렉터리 생성 (없으면)
		if (!existsSync(CUSTOM_PLUGINS_DIR)) {
			mkdirSync(CUSTOM_PLUGINS_DIR, { recursive: true });
		}

		// 임시 ZIP 파일 저장
		const buffer = Buffer.from(await file.arrayBuffer());
		const tempZipPath = join(CUSTOM_PLUGINS_DIR, `temp-${Date.now()}.zip`);
		writeFileSync(tempZipPath, buffer);

		try {
			// ZIP 압축 해제
			const zip = new AdmZip(tempZipPath);
			const zipEntries = zip.getEntries();

			// plugin.json 또는 extension.json 파일 찾기
			let manifestEntry: AdmZip.IZipEntry | null = null;
			let rootFolder = '';
			let manifestFileName = '';

			for (const entry of zipEntries) {
				if (entry.entryName.endsWith('plugin.json') || entry.entryName.endsWith('extension.json')) {
					manifestEntry = entry;
					manifestFileName = entry.entryName.endsWith('plugin.json') ? 'plugin.json' : 'extension.json';
					// 루트 폴더 추출 (예: "my-plugin/plugin.json" → "my-plugin")
					const parts = entry.entryName.split('/');
					if (parts.length > 1) {
						rootFolder = parts[0];
					}
					break;
				}
			}

			if (!manifestEntry) {
				rmSync(tempZipPath);
				return json(
					{ success: false, error: 'ZIP 파일에 plugin.json 또는 extension.json이 없습니다.' },
					{ status: 400 }
				);
			}

			// 매니페스트 검증
			const manifestContent = manifestEntry.getData().toString('utf8');
			const manifestData = JSON.parse(manifestContent);

			// category, license 기본값 제공 (하위 호환성)
			const normalizedData = {
				...manifestData,
				category: manifestData.category || 'plugin',
				license: manifestData.license || 'UNLICENSED'
			};

			const validationResult = safeValidateExtensionManifest(normalizedData);

			if (!validationResult.success) {
				rmSync(tempZipPath);
				return json(
					{
						success: false,
						error: `${manifestFileName} 형식이 올바르지 않습니다.`,
						details: validationResult.error.issues
					},
					{ status: 400 }
				);
			}

			const pluginManifest = validationResult.data;

			// category가 'plugin'인지 확인
			if (pluginManifest.category !== 'plugin') {
				rmSync(tempZipPath);
				return json(
					{
						success: false,
						error: `카테고리가 'plugin'이어야 합니다. (현재: ${pluginManifest.category})`
					},
					{ status: 400 }
				);
			}

			const pluginId = sanitizePath(pluginManifest.id);

			// 플러그인 ID와 폴더명 일치 검증
			if (rootFolder && rootFolder !== pluginId) {
				rmSync(tempZipPath);
				return json(
					{
						success: false,
						error: `ZIP 루트 폴더명(${rootFolder})과 플러그인 ID(${pluginId})가 일치하지 않습니다.`
					},
					{ status: 400 }
				);
			}

			// 이미 존재하는 플러그인 확인
			const targetDir = join(CUSTOM_PLUGINS_DIR, pluginId);
			if (existsSync(targetDir)) {
				rmSync(tempZipPath);
				return json(
					{ success: false, error: `플러그인 "${pluginId}"가 이미 설치되어 있습니다.` },
					{ status: 409 }
				);
			}

			// ZIP 압축 해제
			// rootFolder가 있으면 해당 폴더만 추출, 없으면 전체 추출
			if (rootFolder) {
				// 예: "my-plugin/" 폴더의 내용을 custom-plugins/my-plugin/로 추출
				const tempExtractPath = join(CUSTOM_PLUGINS_DIR, `temp-extract-${Date.now()}`);
				zip.extractAllTo(tempExtractPath, true);

				// 임시 폴더의 rootFolder를 최종 위치로 이동
				const extractedPluginDir = join(tempExtractPath, rootFolder);
				if (existsSync(extractedPluginDir)) {
					// Node.js의 fs.renameSync로 이동
					const fs = await import('fs');
					fs.renameSync(extractedPluginDir, targetDir);
					// 임시 폴더 삭제
					rmSync(tempExtractPath, { recursive: true, force: true });
				} else {
					rmSync(tempExtractPath, { recursive: true, force: true });
					throw new Error('압축 해제된 플러그인 폴더를 찾을 수 없습니다.');
				}
			} else {
				// rootFolder가 없으면 전체 파일을 targetDir에 직접 추출
				mkdirSync(targetDir, { recursive: true });
				zip.extractAllTo(targetDir, true);
			}

			// 임시 ZIP 파일 삭제
			rmSync(tempZipPath);

			// 플러그인 재스캔
			scanPlugins();

			console.log(`✅ [Plugin Upload] 플러그인 업로드 성공: ${pluginId}`);

			return json({
				success: true,
				message: `플러그인 "${pluginManifest.name}"이 성공적으로 업로드되었습니다.`,
				pluginId,
				manifest: pluginManifest
			});
		} catch (error) {
			// 오류 발생 시 임시 파일 정리
			if (existsSync(tempZipPath)) {
				rmSync(tempZipPath);
			}

			console.error('❌ [Plugin Upload] 업로드 처리 중 오류:', error);
			return json(
				{
					success: false,
					error: '플러그인 업로드 중 오류가 발생했습니다.',
					details: error instanceof Error ? error.message : String(error)
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('❌ [Plugin Upload] 요청 처리 중 오류:', error);
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
