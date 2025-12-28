/**
 * 테마 매니페스트 검증 스크립트
 *
 * themes/ 디렉터리의 모든 theme.json 파일을 검증합니다.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { validateThemeManifest } from '../src/lib/types/theme';

const THEMES_DIR = join(process.cwd(), 'themes');

console.log('🔍 테마 매니페스트 검증 시작...\n');

try {
	const themeDirs = readdirSync(THEMES_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	let successCount = 0;
	let errorCount = 0;

	for (const themeDir of themeDirs) {
		const manifestPath = join(THEMES_DIR, themeDir, 'theme.json');

		try {
			const manifestJson = readFileSync(manifestPath, 'utf-8');
			const manifestData = JSON.parse(manifestJson);

			// Zod 검증
			const validatedManifest = validateThemeManifest(manifestData);

			console.log(`✅ ${themeDir}`);
			console.log(`   ID: ${validatedManifest.id}`);
			console.log(`   Name: ${validatedManifest.name}`);
			console.log(`   Version: ${validatedManifest.version}`);
			console.log(`   Author: ${validatedManifest.author.name}`);
			console.log('');

			successCount++;
		} catch (error: any) {
			console.error(`❌ ${themeDir}`);

			if (error.name === 'ZodError') {
				console.error('   Zod 검증 실패:');
				error.issues.forEach((issue: any) => {
					console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
				});
			} else {
				console.error(`   에러: ${error.message}`);
			}
			console.log('');

			errorCount++;
		}
	}

	console.log('─'.repeat(50));
	console.log(`총 ${themeDirs.length}개 테마 검증 완료`);
	console.log(`✅ 성공: ${successCount}개`);
	console.log(`❌ 실패: ${errorCount}개`);

	if (errorCount > 0) {
		process.exit(1);
	}
} catch (error: any) {
	console.error('❌ 검증 스크립트 실행 실패:', error.message);
	process.exit(1);
}
